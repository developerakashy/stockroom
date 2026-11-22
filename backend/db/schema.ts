import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  index,
  pgTable,
  primaryKey,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { statuses } from "../../shared/orders";

export const products = pgTable(
  "products",
  {
    id: bigint({ mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
    sku: text().notNull().unique(),
    name: text().notNull(),
    category: text().notNull(),
    priceCents: bigint("price_cents", { mode: "number" }).notNull(),
    stock: bigint({ mode: "number" }).notNull(),
  },
  (table) => [
    check("stock_nonnegative", sql`${table.stock} >= 0`),
    check("price_nonnegative", sql`${table.priceCents} >= 0`),
  ],
);

export const orders = pgTable(
  "orders",
  {
    reference: text().primaryKey(),
    status: text({ enum: statuses }).notNull(),
    totalCents: bigint("total_cents", { mode: "number" }).notNull(),
    createdAt: text("created_at").notNull(),
    packedAt: text("packed_at"),
    shippedAt: text("shipped_at"),
    cancelledAt: text("cancelled_at"),
    placementKey: text("placement_key"),
  },
  (table) => [
    check(
      "valid_status",
      sql`${table.status} in ('Placed', 'Packed', 'Shipped', 'Cancelled')`,
    ),
    check("total_nonnegative", sql`${table.totalCents} >= 0`),
    uniqueIndex("orders_placement_key").on(table.placementKey),
    index("orders_status_date").on(table.status, table.createdAt),
  ],
);

export const orderItems = pgTable(
  "order_items",
  {
    orderReference: text("order_reference")
      .notNull()
      .references(() => orders.reference),
    productId: bigint("product_id", { mode: "number" })
      .notNull()
      .references(() => products.id),
    name: text().notNull(),
    quantity: bigint({ mode: "number" }).notNull(),
    unitPriceCents: bigint("unit_price_cents", { mode: "number" }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.orderReference, table.productId] }),
    index("order_items_product").on(table.productId),
    check("quantity_positive", sql`${table.quantity} > 0`),
    check("unit_price_nonnegative", sql`${table.unitPriceCents} >= 0`),
  ],
);
