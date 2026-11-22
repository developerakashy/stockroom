import { fileURLToPath } from "node:url";
import { createApp } from "../backend/app";
import { seedCatalogue } from "../backend/db/catalogue";
import { openDatabase } from "../backend/db/client";
import { createTestDatabase } from "./postgres";

const database = await createTestDatabase();
try {
  const store = await openDatabase(database.url);
  try {
    await seedCatalogue(store.db);
    const app = await createApp(
      store.db,
      fileURLToPath(new URL("../dist", import.meta.url)),
    );
    try {
      await app.listen({ port: 3191, host: "127.0.0.1" });
      await new Promise<void>((resolve) => {
        process.once("SIGTERM", resolve);
      });
    } finally {
      await app.close();
    }
  } finally {
    await store.close();
  }
} finally {
  await database.drop();
}
