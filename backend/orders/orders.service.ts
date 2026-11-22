import { randomUUID } from "node:crypto";
import {
  and,
  asc,
  count,
  desc,
  eq,
  getTableColumns,
  inArray,
  sql,
} from "drizzle-orm";
import {
  type DraftItem,
  type Order,
  type OrderCounts,
  type OrderSort,
  type OrderSummary,
  orderListLimit,
  resolveOrderSort,
  type Status,
} from "../../shared/orders";
import type { Store } from "../db/client";
import { orderItems, orders, products } from "../db/schema";

export class OrderError extends Error {
  constructor(
    readonly code:
      | "ORDER_NOT_FOUND"
      | "UNKNOWN_PRODUCT"
      | "INSUFFICIENT_STOCK"
      | "INVALID_TRANSITION"
      | "IDEMPOTENCY_CONFLICT",
    message: string,
    readonly details?: { productId: number; available: number },
  ) {
    super(message);
  }
}

const transitions: Record<Status, readonly Status[]> = {
  Placed: ["Packed", "Cancelled"],
  Packed: ["Shipped", "Cancelled"],
  Shipped: [],
  Cancelled: [],
};

async function getOrder(
  db: Pick<Store, "select">,
  reference: string,
  lock = false,
): Promise<Order> {
  const query = db
    .select({
      ...ordersFields,
      packedAt: orders.packedAt,
      shippedAt: orders.shippedAt,
      cancelledAt: orders.cancelledAt,
    })
    .from(orders)
    .where(eq(orders.reference, reference));
  const [order] = await (lock ? query.for("update") : query);
  if (!order)
    throw new OrderError("ORDER_NOT_FOUND", "Order reference was not found.");
  const items = await db
    .select({
      productId: orderItems.productId,
      name: orderItems.name,
      quantity: orderItems.quantity,
      unitPriceCents: orderItems.unitPriceCents,
    })
    .from(orderItems)
    .where(eq(orderItems.orderReference, reference))
    .orderBy(orderItems.productId);
  return {
    ...order,
    items,
    units: items.reduce((total, item) => total + item.quantity, 0),
  };
}

export function createOrderService(db: Store) {
  return {
    catalogue: () => db.select().from(products).orderBy(products.id),
    recommendations() {
      const orderedUnits =
        sql`sum(case when ${orders.status} <> 'Cancelled' then ${orderItems.quantity} else 0 end)`.mapWith(
          Number,
        );
      return db
        .select({ ...getTableColumns(products), orderedUnits })
        .from(products)
        .leftJoin(orderItems, eq(orderItems.productId, products.id))
        .leftJoin(orders, eq(orders.reference, orderItems.orderReference))
        .groupBy(products.id)
        .orderBy(desc(orderedUnits), desc(products.stock), products.id)
        .limit(4);
    },
    detail: (reference: string) => getOrder(db, reference),
    async counts(): Promise<OrderCounts> {
      const rows = await db
        .select({ status: orders.status, count: count() })
        .from(orders)
        .groupBy(orders.status);
      const counts: OrderCounts = {
        Placed: 0,
        Packed: 0,
        Shipped: 0,
        Cancelled: 0,
      };
      for (const row of rows) counts[row.status] = row.count;
      return counts;
    },
    async list(
      search: string,
      status?: Status,
      requestedSort?: OrderSort,
    ): Promise<OrderSummary[]> {
      const sort = resolveOrderSort(requestedSort, status);
      const byDate = sort === "oldest" ? asc : desc;
      const units = sql`sum(${orderItems.quantity})`.mapWith(Number);
      const sortColumn = {
        newest: undefined,
        oldest: undefined,
        "highest-total": desc(orders.totalCents),
        "lowest-total": asc(orders.totalCents),
        "most-units": desc(units),
        "fewest-units": asc(units),
      }[sort];
      return db
        .select({
          ...ordersFields,
          units,
        })
        .from(orders)
        .innerJoin(orderItems, eq(orders.reference, orderItems.orderReference))
        .where(
          and(
            search
              ? sql`strpos(${orders.reference}, ${search.toUpperCase()}) > 0`
              : undefined,
            status ? eq(orders.status, status) : undefined,
          ),
        )
        .groupBy(orders.reference)
        .orderBy(
          ...(sortColumn ? [sortColumn] : []),
          byDate(orders.createdAt),
          byDate(orders.reference),
        )
        .limit(orderListLimit);
    },
    async place(
      draft: DraftItem[],
      placementKey?: string,
    ): Promise<{ order: Order; replayed: boolean }> {
      const quantities = new Map<number, number>();
      for (const item of draft) {
        quantities.set(
          item.productId,
          (quantities.get(item.productId) ?? 0) + item.quantity,
        );
      }

      return db.transaction(async (tx) => {
        await tx.execute(sql`set local lock_timeout = '5s'`);
        if (placementKey) {
          // Serialize retries of this checkout key across app processes.
          await tx.execute(
            sql`select pg_advisory_xact_lock(hashtextextended(${placementKey}::text, 0))`,
          );
          const [existing] = await tx
            .select({ reference: orders.reference })
            .from(orders)
            .where(eq(orders.placementKey, placementKey));
          if (existing) {
            const order = await getOrder(tx, existing.reference);
            if (
              order.items.length !== quantities.size ||
              order.items.some(
                ({ productId, quantity }) =>
                  quantities.get(productId) !== quantity,
              )
            ) {
              throw new OrderError(
                "IDEMPOTENCY_CONFLICT",
                "This checkout key already belongs to an order with different items.",
              );
            }
            return { order, replayed: true };
          }
        }
        const catalogue = await tx
          .select()
          .from(products)
          .where(inArray(products.id, [...quantities.keys()]))
          .orderBy(products.id)
          .for("no key update");
        const byId = new Map(catalogue.map((product) => [product.id, product]));
        const reference = `ORD-${randomUUID().replaceAll("-", "").slice(0, 16).toUpperCase()}`;
        const items = [...quantities].map(([productId, quantity]) => {
          const product = byId.get(productId);
          if (!product)
            throw new OrderError(
              "UNKNOWN_PRODUCT",
              `Product #${productId} was not found.`,
            );
          if (product.stock < quantity) {
            throw new OrderError(
              "INSUFFICIENT_STOCK",
              `${product.name} has ${product.stock} available. Adjust the quantity and try again.`,
              {
                productId,
                available: product.stock,
              },
            );
          }
          return {
            orderReference: reference,
            productId,
            name: product.name,
            unitPriceCents: product.priceCents,
            quantity,
          };
        });
        const totalCents = items.reduce(
          (total, item) => total + item.unitPriceCents * item.quantity,
          0,
        );
        await tx.insert(orders).values({
          reference,
          status: "Placed",
          totalCents,
          createdAt: new Date().toISOString(),
          placementKey,
        });
        await tx.insert(orderItems).values(items);
        for (const { productId, quantity } of items) {
          await tx
            .update(products)
            .set({ stock: sql`${products.stock} - ${quantity}` })
            .where(eq(products.id, productId));
        }
        return { order: await getOrder(tx, reference), replayed: false };
      });
    },
    changeStatus(reference: string, status: Status): Promise<Order> {
      return db.transaction(async (tx) => {
        await tx.execute(sql`set local lock_timeout = '5s'`);
        const order = await getOrder(tx, reference, true);
        if (!transitions[order.status].includes(status)) {
          throw new OrderError(
            "INVALID_TRANSITION",
            `An order with status ${order.status} cannot move to ${status}.`,
          );
        }
        const timestamp = new Date().toISOString();
        const event =
          status === "Packed"
            ? { packedAt: timestamp }
            : status === "Shipped"
              ? { shippedAt: timestamp }
              : { cancelledAt: timestamp };
        await tx
          .update(orders)
          .set({ status, ...event })
          .where(eq(orders.reference, reference));
        if (status === "Cancelled") {
          for (const item of order.items) {
            await tx
              .update(products)
              .set({ stock: sql`${products.stock} + ${item.quantity}` })
              .where(eq(products.id, item.productId));
          }
        }
        return { ...order, status, ...event };
      });
    },
  };
}

const ordersFields = {
  reference: orders.reference,
  status: orders.status,
  totalCents: orders.totalCents,
  createdAt: orders.createdAt,
};
