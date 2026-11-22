import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../backend/app";
import { seedCatalogue } from "../backend/db/catalogue";
import { openDatabase } from "../backend/db/client";
import { orders } from "../backend/db/schema";
import type { OrderSummary, Product } from "../shared/orders";

import { createTestDatabase } from "./postgres";

let database: Awaited<ReturnType<typeof createTestDatabase>>;
let store: Awaited<ReturnType<typeof openDatabase>>;
let app: Awaited<ReturnType<typeof createApp>>;
let api: ReturnType<typeof request>;
let mug: Product;
let bottle: Product;

beforeEach(async () => {
  database = await createTestDatabase();
  store = await openDatabase(database.url);
  await seedCatalogue(store.db);
  app = await createApp(store.db);
  api = request(app.getHttpServer());
  const { body } = await api.get("/api/products").expect(200);
  mug = body.find((product: Product) => product.sku === "SW-102");
  bottle = body.find((product: Product) => product.sku === "SW-104");
});

afterEach(async () => {
  await app?.close();
  await store?.close();
  await database?.drop();
});

function place(quantity: number) {
  return api
    .post("/api/orders")
    .send({ items: [{ productId: mug.id, quantity }] });
}

async function expectMugStock(stock: number) {
  const result = await api.get("/api/products").expect(200);
  expect(
    result.body.find((product: Product) => product.id === mug.id).stock,
  ).toBe(stock);
}

function change(reference: string, status: string) {
  return api.patch(`/api/orders/${reference}/status`).send({ status });
}

describe("orders API", () => {
  it("places a multi-product order, deducts stock and returns the server-priced total", async () => {
    const { body: catalogue } = await api.get("/api/products").expect(200);
    const tote = catalogue.find((product: Product) => product.sku === "SW-101");
    const { body } = await api
      .post("/api/orders")
      .send({
        items: [
          { productId: mug.id, quantity: 1 },
          { productId: mug.id, quantity: 1 },
          { productId: tote.id, quantity: 1 },
        ],
      })
      .expect(201);
    expect(body).toMatchObject({
      status: "Placed",
      totalCents: 6000,
      units: 3,
    });
    expect(body.items).toHaveLength(2);
    await expectMugStock(3);
    const { body: updated } = await api.get("/api/products").expect(200);
    expect(
      updated.find((product: Product) => product.id === tote.id).stock,
    ).toBe(17);
    await api.get(`/api/orders/${body.reference}`).expect(200, body);
    await api.get("/api/orders").query({ status: "Packed" }).expect(200, []);
  });

  it("finds orders by a case-insensitive reference substring and excludes other orders", async () => {
    const { body: matchingOrder } = await place(1).expect(201);
    const { body: otherOrder } = await place(1).expect(201);

    const { body } = await api
      .get("/api/orders")
      .query({ search: matchingOrder.reference.slice(4).toLowerCase() })
      .expect(200);
    const references = body.map(({ reference }: OrderSummary) => reference);
    expect(references).toContain(matchingOrder.reference);
    expect(references).not.toContain(otherOrder.reference);
  });

  it("counts all orders by status and includes empty queues", async () => {
    const { body: order } = await place(1).expect(201);
    await place(1).expect(201);
    await change(order.reference, "Packed").expect(200);

    await api.get("/api/orders/counts").expect(200, {
      Placed: 1,
      Packed: 1,
      Shipped: 0,
      Cancelled: 0,
    });
  });

  it("sorts filtered orders by date or total and rejects unknown sort values", async () => {
    const { body: older } = await place(2).expect(201);
    const { body: newer } = await place(1).expect(201);
    await store.db
      .update(orders)
      .set({ createdAt: "2025-01-01T00:00:00.000Z" })
      .where(eq(orders.reference, older.reference));
    await store.db
      .update(orders)
      .set({ createdAt: "2025-01-02T00:00:00.000Z" })
      .where(eq(orders.reference, newer.reference));

    for (const [sort, expected] of [
      ["", [older.reference, newer.reference]],
      ["newest", [newer.reference, older.reference]],
      ["oldest", [older.reference, newer.reference]],
      ["highest-total", [older.reference, newer.reference]],
      ["lowest-total", [newer.reference, older.reference]],
      ["most-units", [older.reference, newer.reference]],
      ["fewest-units", [newer.reference, older.reference]],
    ] as const) {
      const { body } = await api
        .get("/api/orders")
        .query({ status: "Placed", ...(sort && { sort }) })
        .expect(200);
      expect(body.map(({ reference }: OrderSummary) => reference)).toEqual(
        expected,
      );
    }
    await api.get("/api/orders").query({ sort: "unknown" }).expect(400);
  });

  it("rolls back a partial deduction when a product is unavailable", async () => {
    const { body } = await api
      .post("/api/orders")
      .send({
        items: [
          { productId: mug.id, quantity: 2 },
          { productId: bottle.id, quantity: 1 },
        ],
      })
      .expect(409);
    expect(body.error).toMatchObject({
      code: "INSUFFICIENT_STOCK",
      details: { productId: bottle.id, available: 0 },
    });
    await expectMugStock(5);
    await api.get("/api/orders").expect(200, []);
  });

  it("rejects skipped fulfilment and cancellation after shipping", async () => {
    const { body } = await place(2).expect(201);
    const rejected = await change(body.reference, "Shipped").expect(409);
    expect(rejected.body.error.code).toBe("INVALID_TRANSITION");
    await api.get(`/api/orders/${body.reference}`).expect(200, body);
    await change(body.reference, "Packed").expect(200);
    await change(body.reference, "Shipped").expect(200);
    await change(body.reference, "Cancelled").expect(409);
    await expectMugStock(3);
  });

  it.each(["Placed", "Packed"])(
    "restores stock once when cancelled from %s",
    async (status) => {
      const { body } = await place(2).expect(201);
      if (status === "Packed")
        await change(body.reference, "Packed").expect(200);
      await change(body.reference, "Cancelled").expect(200);
      await expectMugStock(5);
      await change(body.reference, "Cancelled").expect(409);
      await expectMugStock(5);
    },
  );

  it("only accepts one of two requests competing for stock", async () => {
    const second = await openDatabase(database.url);
    let secondApp: Awaited<ReturnType<typeof createApp>> | undefined;
    try {
      secondApp = await createApp(second.db);
      const results = await Promise.all([
        place(4),
        request(secondApp.getHttpServer())
          .post("/api/orders")
          .send({ items: [{ productId: mug.id, quantity: 4 }] }),
      ]);
      expect(results.map((result) => result.status).sort()).toEqual([201, 409]);
      await expectMugStock(1);
    } finally {
      await secondApp?.close();
      await second.close();
    }
  });

  it("ranks products by units ordered and excludes cancelled orders", async () => {
    const { body: placed } = await place(2).expect(201);
    const { body: cancelled } = await place(3).expect(201);
    await change(cancelled.reference, "Cancelled").expect(200);
    const recommendations = await api
      .get("/api/products/recommended")
      .expect(200);
    expect(recommendations.body[0]).toMatchObject({
      id: mug.id,
      orderedUnits: 2,
      stock: 3,
    });
    await change(placed.reference, "Cancelled").expect(200);
    const after = await api.get("/api/products/recommended").expect(200);
    expect(
      after.body.every(
        (product: { orderedUnits: number }) => product.orderedUnits === 0,
      ),
    ).toBe(true);
  });

  it("replays an equivalent keyed checkout and rejects changes to its items", async () => {
    const key = randomUUID();
    const submit = (quantities: number[]) =>
      api
        .post("/api/orders")
        .set("Idempotency-Key", key)
        .send({
          items: quantities.map((quantity) => ({
            productId: mug.id,
            quantity,
          })),
        });
    const created = await submit([2]).expect(201);
    const { body } = created;
    expect(created.headers.location).toBe(`/api/orders/${body.reference}`);
    await submit([1, 1])
      .expect("Location", created.headers.location)
      .expect(200, body);
    const conflict = await submit([3]).expect(409);
    expect(conflict.body.error.code).toBe("IDEMPOTENCY_CONFLICT");
    await expectMugStock(3);
    const { body: entries } = await api.get("/api/orders").expect(200);
    expect(entries).toHaveLength(1);
    const packed = await change(body.reference, "Packed").expect(200);
    const cancelled = await change(body.reference, "Cancelled").expect(200);
    expect(Date.parse(packed.body.packedAt)).toBeGreaterThanOrEqual(
      Date.parse(body.createdAt),
    );
    expect(Date.parse(cancelled.body.cancelledAt)).toBeGreaterThanOrEqual(
      Date.parse(packed.body.packedAt),
    );
    expect(cancelled.body.shippedAt).toBeNull();
    await api.get(`/api/orders/${body.reference}`).expect(200, cancelled.body);
  });

  it("keeps stock and orders after reopening and reseeding", async () => {
    const { body } = await place(2).expect(201);
    await app.close();
    await store.close();
    store = await openDatabase(database.url);
    await seedCatalogue(store.db);
    app = await createApp(store.db);
    api = request(app.getHttpServer());
    await expectMugStock(3);
    await api.get(`/api/orders/${body.reference}`).expect(200, body);
  });

  it("rejects non-integer or empty quantities at the API boundary", async () => {
    await place(1.5).expect(400);
    await place(0).expect(400);
    await api.post("/api/orders").send({ items: [] }).expect(400);
    await expectMugStock(5);
  });

  it.each([
    ["malformed JSON", "application/json", '{"items":', 400, "INVALID_JSON"],
    [
      "oversized JSON",
      "application/json",
      JSON.stringify({ items: "x".repeat(32768) }),
      413,
      "REQUEST_TOO_LARGE",
    ],
    [
      "unsupported media",
      "application/xml",
      "<items/>",
      415,
      "UNSUPPORTED_MEDIA_TYPE",
    ],
  ])(
    "rejects %s without writing an order",
    async (_name, contentType, payload, status, code) => {
      const response = await app.inject({
        method: "POST",
        url: "/api/orders",
        headers: { "content-type": contentType },
        payload,
      });
      expect(response.statusCode).toBe(status);
      expect(response.headers["cache-control"]).toBe("no-store");
      expect(response.json().error.code).toBe(code);
      await expectMugStock(5);
      await api.get("/api/orders").expect(200, []);
    },
  );

  it("rejects an invalid checkout key, unexpected fields, and unknown products", async () => {
    const item = { productId: mug.id, quantity: 1 };
    const invalidKey = await api
      .post("/api/orders")
      .set("Idempotency-Key", "not-a-uuid")
      .send({ items: [item] })
      .expect(400);
    expect(invalidKey.body.error.code).toBe("INVALID_INPUT");

    const extraField = await api
      .post("/api/orders")
      .send({ items: [{ ...item, unitPriceCents: 1 }] })
      .expect(400);
    expect(extraField.body.error).toMatchObject({
      code: "INVALID_INPUT",
      details: [{ code: "unrecognized_keys", path: ["items", 0] }],
    });

    const unknownProduct = await api
      .post("/api/orders")
      .send({ items: [item, { productId: 99999, quantity: 1 }] })
      .expect(400);
    expect(unknownProduct.body.error.code).toBe("UNKNOWN_PRODUCT");
    await expectMugStock(5);
    await api.get("/api/orders").expect(200, []);
  });

  it("distinguishes invalid references, missing orders, and missing endpoints", async () => {
    const invalid = await api.get("/api/orders/bad-reference").expect(400);
    expect(invalid.body.error.code).toBe("INVALID_INPUT");

    const missing = await api
      .get("/api/orders/ORD-0000000000000000")
      .expect(404);
    expect(missing.body.error.code).toBe("ORDER_NOT_FOUND");

    const unknown = await api
      .get("/api/unknown")
      .expect("Cache-Control", "no-store")
      .expect(404);
    expect(unknown.body.error.code).toBe("NOT_FOUND");
  });

  it("rejects invalid status updates and leaves the order unchanged", async () => {
    const { body } = await place(1).expect(201);
    const invalid = await change(body.reference, "Delivered").expect(400);
    expect(invalid.body.error.code).toBe("INVALID_INPUT");
    await api.get(`/api/orders/${body.reference}`).expect(200, body);
    await expectMugStock(4);
  });
});
