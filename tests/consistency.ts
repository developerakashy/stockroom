import assert from "node:assert/strict";
import { type ChildProcess, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { test } from "node:test";
import { seedCatalogue } from "../backend/db/catalogue";
import { openDatabase } from "../backend/db/client";
import type {
  DraftItem,
  Order,
  OrderSummary,
  Product,
  Status,
} from "../shared/orders";

import { verifyDatabaseGuardrails } from "./database-guardrails";
import { createTestDatabase } from "./postgres";

function startServer(databaseUrl: string, processes: ChildProcess[]) {
  const server = spawn(
    process.execPath,
    ["--import", "tsx", "backend/server.ts"],
    {
      env: {
        ...process.env,
        PORT: "0",
        DATABASE_URL: databaseUrl,
        DATABASE_URL_UNPOOLED: databaseUrl,
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  processes.push(server);

  return new Promise<string>((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(
      () => reject(new Error("Server did not start within 10 seconds.")),
      10_000,
    );
    server.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    server.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
      const url = stdout.match(/http:\/\/127\.0\.0\.1:\d+/)?.[0];
      if (!url) return;
      clearTimeout(timer);
      resolve(url);
    });
    server.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    server.once("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`Server exited with code ${code}. ${stderr}`));
    });
  });
}

async function stopServer(server: ChildProcess) {
  if (!server.pid || server.exitCode !== null || server.signalCode !== null)
    return;
  const exited = once(server, "exit");
  const timer = setTimeout(() => server.kill("SIGKILL"), 3_000);
  server.kill("SIGTERM");
  try {
    await exited;
  } finally {
    clearTimeout(timer);
  }
}

function place(url: string, items: DraftItem[], key?: string) {
  return fetch(`${url}/api/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(key && { "Idempotency-Key": key }),
    },
    body: JSON.stringify({ items }),
    signal: AbortSignal.timeout(15_000),
  });
}

function update(url: string, reference: string, status: Status) {
  return fetch(`${url}/api/orders/${reference}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
    signal: AbortSignal.timeout(15_000),
  });
}

async function read<T>(url: string, endpoint: string): Promise<T> {
  const response = await fetch(`${url}/api${endpoint}`, {
    signal: AbortSignal.timeout(10_000),
  });
  assert.equal(response.status, 200);
  return response.json();
}

async function expectConflict(response: Response, code: string) {
  assert.equal(response.status, 409);
  assert.equal((await response.json()).error.code, code);
}

function measureBurst(label: string) {
  const latencies: number[] = [];
  const statuses = new Map<number, number>();
  let beganAt = 0;
  let endedAt = 0;
  return {
    async send(request: () => Promise<Response>) {
      const started = performance.now();
      beganAt ||= started;
      const response = await request();
      endedAt = performance.now();
      latencies.push(endedAt - started);
      statuses.set(response.status, (statuses.get(response.status) ?? 0) + 1);
      return response;
    },
    get count() {
      return latencies.length;
    },
    report() {
      const sorted = [...latencies].sort((a, b) => a - b);
      const duration = endedAt - beganAt;
      const percentile = (p: number) =>
        sorted[Math.ceil(sorted.length * p) - 1];
      const ok = [...statuses].reduce(
        (sum, [status, count]) =>
          sum + (status >= 200 && status < 300 ? count : 0),
        0,
      );
      const mix = [...statuses]
        .sort(([a], [b]) => a - b)
        .map(([status, count]) => `${status}=${count}`)
        .join(", ");
      return `${label} | ${sorted.length} requests | HTTP success ${ok}/${sorted.length} (${((100 * ok) / sorted.length).toFixed(1)}%) | ${mix} | ${((1000 * sorted.length) / duration).toFixed(0)} req/s | p50 ${percentile(0.5).toFixed(1)} ms | p95 ${percentile(0.95).toFixed(1)} ms`;
    },
  };
}

test("two server processes preserve inventory under concurrent placement and fulfilment", async (t) => {
  const database = await createTestDatabase();
  const processes: ChildProcess[] = [];
  t.after(async () => {
    await Promise.all(processes.map(stopServer));
    await database.drop();
  });
  const store = await openDatabase(database.url);
  try {
    await seedCatalogue(store.db);
  } finally {
    await store.close();
  }
  const [first, second] = await Promise.all([
    startServer(database.url, processes),
    startServer(database.url, processes),
  ]);
  t.diagnostic(
    "Demo: 2 Fastify processes, 1 PostgreSQL database, fresh isolated schema",
  );
  const base = (index: number) => (index % 2 === 0 ? first : second);
  const catalogue = await read<Product[]>(first, "/products");
  const mug = catalogue.find(({ sku }) => sku === "SW-102");
  const notebook = catalogue.find(({ sku }) => sku === "SW-103");
  const bottle = catalogue.find(({ sku }) => sku === "SW-104");
  assert.ok(mug && notebook && bottle);
  assert.equal(mug.stock, 5);
  assert.equal(notebook.stock, 24);
  assert.equal(bottle.stock, 0);

  const placementBurst = measureBurst("Checkout contention");
  const [placements, unavailable] = await Promise.all([
    Promise.all(
      Array.from({ length: 80 }, (_, i) =>
        placementBurst.send(() =>
          place(base(i), [{ productId: notebook.id, quantity: 2 }]),
        ),
      ),
    ),
    Promise.all(
      Array.from({ length: 40 }, (_, i) =>
        placementBurst.send(() =>
          place(base(i + 1), [
            { productId: mug.id, quantity: 2 },
            { productId: bottle.id, quantity: 1 },
          ]),
        ),
      ),
    ),
  ]);
  await Promise.all(
    unavailable.map((response) =>
      expectConflict(response, "INSUFFICIENT_STOCK"),
    ),
  );
  const accepted: Order[] = [];
  for (const response of placements) {
    if (response.status === 201) accepted.push(await response.json());
    else await expectConflict(response, "INSUFFICIENT_STOCK");
  }
  assert.equal(accepted.length, 12);
  assert.equal(new Set(accepted.map(({ reference }) => reference)).size, 12);
  const orders = await read<OrderSummary[]>(second, "/orders");
  assert.deepEqual(
    new Set(orders.map(({ reference }) => reference)),
    new Set(accepted.map(({ reference }) => reference)),
  );
  for (const order of accepted) {
    assert.equal(order.status, "Placed");
    assert.equal(order.totalCents, 2 * notebook.priceCents);
    assert.deepEqual(
      order.items.map(({ productId, quantity }) => ({ productId, quantity })),
      [{ productId: notebook.id, quantity: 2 }],
    );
  }
  const afterPlacement = await read<Product[]>(second, "/products");
  assert.equal(afterPlacement.find(({ id }) => id === mug.id)?.stock, 5);
  assert.equal(afterPlacement.find(({ id }) => id === notebook.id)?.stock, 0);
  assert.equal(afterPlacement.find(({ id }) => id === bottle.id)?.stock, 0);
  t.diagnostic(placementBurst.report());
  t.diagnostic(
    "Inventory: all 24 notebook units allocated, zero oversold, all 5 mugs untouched by failed orders",
  );

  const cancellationBurst = measureBurst("Duplicate cancellations");
  await Promise.all(
    accepted.map(async ({ reference }) => {
      const cancellations = await Promise.all(
        Array.from({ length: 5 }, (_, i) =>
          cancellationBurst.send(() => update(base(i), reference, "Cancelled")),
        ),
      );
      assert.equal(
        cancellations.filter(({ status }) => status === 200).length,
        1,
      );
      await Promise.all(
        cancellations.map(async (response) => {
          if (response.status === 200)
            assert.equal((await response.json()).status, "Cancelled");
          else await expectConflict(response, "INVALID_TRANSITION");
        }),
      );
    }),
  );
  const restored = await read<Product[]>(first, "/products");
  assert.deepEqual(restored, catalogue);
  assert.equal(
    (await read<OrderSummary[]>(second, "/orders?status=Cancelled")).length,
    12,
  );
  t.diagnostic(cancellationBurst.report());
  t.diagnostic("Restoration: all stock restored exactly once");

  const checkoutKey = randomUUID();
  const items = [{ productId: mug.id, quantity: 2 }];
  const replayBurst = measureBurst("Same checkout key");
  const retries = await Promise.all(
    Array.from({ length: 32 }, (_, i) =>
      replayBurst.send(() => place(base(i), items, checkoutKey)),
    ),
  );
  assert.equal(retries.filter(({ status }) => status === 201).length, 1);
  assert.equal(retries.filter(({ status }) => status === 200).length, 31);
  const [packed, ...replays]: Order[] = await Promise.all(
    retries.map((response) => response.json()),
  );
  for (const replay of replays) assert.deepEqual(replay, packed);
  assert.equal(
    (await read<Product[]>(first, "/products")).find(({ id }) => id === mug.id)
      ?.stock,
    3,
  );
  t.diagnostic(replayBurst.report());
  t.diagnostic("Idempotency: 1 order and 1 stock deduction for 32 submissions");
  await expectConflict(
    await update(first, packed.reference, "Shipped"),
    "INVALID_TRANSITION",
  );
  const pack = await update(first, packed.reference, "Packed");
  assert.equal(pack.status, 200);
  const packedOrder: Order = await pack.json();
  assert.equal(packedOrder.status, "Packed");
  assert.ok(packedOrder.packedAt);

  const terminalBurst = measureBurst("Ship/cancel race");
  const race = await Promise.all([
    terminalBurst.send(() => update(first, packed.reference, "Shipped")),
    terminalBurst.send(() => update(second, packed.reference, "Cancelled")),
  ]);
  assert.deepEqual(race.map(({ status }) => status).sort(), [200, 409]);
  const winner = race[0].status === 200 ? "Shipped" : "Cancelled";
  let terminalOrder: Order | undefined;
  for (const response of race) {
    if (response.status === 200) terminalOrder = await response.json();
    else await expectConflict(response, "INVALID_TRANSITION");
  }
  assert.ok(terminalOrder);
  assert.equal(terminalOrder.status, winner);
  assert.ok(
    winner === "Shipped" ? terminalOrder.shippedAt : terminalOrder.cancelledAt,
  );
  assert.equal(terminalOrder.packedAt, packedOrder.packedAt);

  t.diagnostic(terminalBurst.report());
  const postgresVersion = await verifyDatabaseGuardrails(
    database.url,
    mug.id,
    packed.reference,
    checkoutKey,
  );
  t.diagnostic(
    `PostgreSQL ${postgresVersion} | 5 invalid SQL writes blocked (CHECK, UNIQUE, FOREIGN KEY) | earlier valid debit rolled back`,
  );

  const beforeRestart = await read<Product[]>(first, "/products");
  const ordersBeforeRestart = await read<OrderSummary[]>(first, "/orders");
  assert.equal(
    beforeRestart.find(({ id }) => id === mug.id)?.stock,
    winner === "Shipped" ? 3 : 5,
  );
  await Promise.all(processes.map(stopServer));
  const restarted = await startServer(database.url, processes);
  assert.deepEqual(
    await read<Product[]>(restarted, "/products"),
    beforeRestart,
  );
  const persisted = await read<OrderSummary[]>(restarted, "/orders");
  assert.deepEqual(persisted, ordersBeforeRestart);
  assert.equal(persisted.length, 13);
  assert.equal(
    persisted.filter(({ status }) => status === "Cancelled").length,
    winner === "Cancelled" ? 13 : 12,
  );
  const persistedOrder = await read<Order>(
    restarted,
    `/orders/${packed.reference}`,
  );
  assert.deepEqual(persistedOrder, terminalOrder);
  const retriedAfterRestart = await place(restarted, items, checkoutKey);
  assert.equal(retriedAfterRestart.status, 200);
  assert.deepEqual(await retriedAfterRestart.json(), terminalOrder);
  assert.deepEqual(
    await read<Product[]>(restarted, "/products"),
    beforeRestart,
  );
  t.diagnostic(
    `Ship/cancel race winner: ${winner}. Restart preserved all 13 orders, their terminal states and exact inventory.`,
  );
  const measured =
    placementBurst.count +
    cancellationBurst.count +
    replayBurst.count +
    terminalBurst.count;
  t.diagnostic(
    `Correctness: ${measured}/${measured} measured requests matched scenario expectations (100.0%) | 0 unexpected responses`,
  );
});
