export const statuses = ["Placed", "Packed", "Shipped", "Cancelled"] as const;
export type Status = (typeof statuses)[number];
export type OrderCounts = Record<Status, number>;
export const orderListLimit = 100;

export const orderSorts = [
  "newest",
  "oldest",
  "highest-total",
  "lowest-total",
  "most-units",
  "fewest-units",
] as const;
export type OrderSort = (typeof orderSorts)[number];

export function resolveOrderSort(
  sort: OrderSort | undefined,
  status: string | undefined,
): OrderSort {
  return (
    sort ?? (status === "Placed" || status === "Packed" ? "oldest" : "newest")
  );
}

export interface Product {
  id: number;
  name: string;
  sku: string;
  category: string;
  priceCents: number;
  stock: number;
}

export interface RankedProduct extends Product {
  orderedUnits: number;
}

export interface OrderItem {
  productId: number;
  name: string;
  quantity: number;
  unitPriceCents: number;
}

export interface OrderSummary {
  reference: string;
  status: Status;
  totalCents: number;
  createdAt: string;
  units: number;
}

export function sortOrderSummaries(
  entries: readonly OrderSummary[],
  requestedSort: OrderSort | undefined,
  status: string,
): OrderSummary[] {
  const sort = resolveOrderSort(requestedSort, status);
  const byDate = sort === "oldest" ? 1 : -1;
  return [...entries].sort((left, right) => {
    const comparison = {
      newest: 0,
      oldest: 0,
      "highest-total": right.totalCents - left.totalCents,
      "lowest-total": left.totalCents - right.totalCents,
      "most-units": right.units - left.units,
      "fewest-units": left.units - right.units,
    }[sort];
    return (
      comparison ||
      byDate *
        (left.createdAt.localeCompare(right.createdAt) ||
          left.reference.localeCompare(right.reference))
    );
  });
}

export interface Order extends OrderSummary {
  packedAt: string | null;
  shippedAt: string | null;
  cancelledAt: string | null;
  items: OrderItem[];
}

export interface DraftItem {
  productId: number;
  quantity: number;
}
