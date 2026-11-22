import { seedCatalogue } from "./db/catalogue";
import { openDatabase } from "./db/client";

const store = await openDatabase();
try {
  await seedCatalogue(store.db);
  console.log("Catalogue ready.");
} finally {
  await store.close();
}
