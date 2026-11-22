import type { Store } from "./client";
import { products } from "./schema";

const catalogue = [
  {
    sku: "SW-101",
    name: "Everyday Tote",
    category: "Accessories",
    priceCents: 2400,
    stock: 18,
  },
  {
    sku: "SW-102",
    name: "Studio Mug",
    category: "Homewares",
    priceCents: 1800,
    stock: 5,
  },
  {
    sku: "SW-103",
    name: "Field Notebook",
    category: "Stationery",
    priceCents: 1250,
    stock: 24,
  },
  {
    sku: "SW-104",
    name: "Trail Bottle",
    category: "Accessories",
    priceCents: 3200,
    stock: 0,
  },
  {
    sku: "SW-105",
    name: "Desk Tray",
    category: "Homewares",
    priceCents: 2800,
    stock: 4,
  },
  {
    sku: "SW-106",
    name: "Daily Pen Set",
    category: "Stationery",
    priceCents: 1600,
    stock: 16,
  },
];

export async function seedCatalogue(db: Store) {
  await db
    .insert(products)
    .values(catalogue)
    .onConflictDoNothing({ target: products.sku });
}
