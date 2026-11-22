import { fileURLToPath } from "node:url";
import { createApp } from "./app";
import { openDatabase } from "./db/client";

const port = Number(process.env.PORT ?? 3001);
if (!Number.isInteger(port) || port < 0 || port > 65535) {
  throw new Error("PORT must be an integer between 0 and 65535.");
}

const store = await openDatabase();
let app: Awaited<ReturnType<typeof createApp>> | undefined;

async function close() {
  try {
    await app?.close();
  } finally {
    await store.close();
  }
}

try {
  app = await createApp(
    store.db,
    fileURLToPath(new URL("../dist", import.meta.url)),
  );
  const server = await app.listen({ port, host: "127.0.0.1" });
  const address = server.address();
  if (address && typeof address !== "string") {
    console.log(`Commerce API listening on http://127.0.0.1:${address.port}`);
  }
} catch (error) {
  await close();
  throw error;
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    void close().catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
  });
}
