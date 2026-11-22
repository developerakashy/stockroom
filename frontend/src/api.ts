import { queryOptions } from "@tanstack/react-query";
import {
  type DraftItem,
  type Order,
  type OrderCounts,
  type OrderSort,
  type OrderSummary,
  orderListLimit,
  type Product,
  type RankedProduct,
  type Status,
  sortOrderSummaries,
} from "../../shared/orders";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
    readonly details?: { productId?: number; available?: number },
  ) {
    super(message);
  }
}

async function request<T>(
  path: string,
  signal?: AbortSignal,
  method = "GET",
  body?: unknown,
  idempotencyKey?: string,
): Promise<T> {
  const response = await fetch(`/api${path}`, {
    signal,
    method,
    headers: {
      ...(body !== undefined && { "Content-Type": "application/json" }),
      ...(idempotencyKey && { "Idempotency-Key": idempotencyKey }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new ApiError(
      data?.error?.message ?? "The server could not complete the request.",
      data?.error?.code ?? "REQUEST_FAILED",
      response.status,
      data?.error?.details,
    );
  }
  return response.json();
}

export const catalogueQuery = queryOptions({
  queryKey: ["products"],
  queryFn: ({ signal }) => request<Product[]>("/products", signal),
});

export const recommendedQuery = queryOptions({
  queryKey: ["products", "recommended"],
  queryFn: ({ signal }) =>
    request<RankedProduct[]>("/products/recommended", signal),
});

export const orderCountsQuery = queryOptions({
  queryKey: ["orders", "counts"],
  queryFn: ({ signal }) => request<OrderCounts>("/orders/counts", signal),
});

export function ordersQuery(
  search: string,
  status: Status | "",
  sort?: OrderSort,
) {
  const params = new URLSearchParams();
  const reference = search.trim();
  if (reference) params.set("search", reference);
  if (status) params.set("status", status);
  if (sort) params.set("sort", sort);
  return queryOptions<OrderSummary[]>({
    queryKey: ["orders", "list", reference, status, sort ?? ""],
    placeholderData: (previousRows, previousQuery) => {
      // A full page may omit rows needed for the new sort.
      const key = previousQuery?.queryKey;
      if (
        previousRows &&
        previousRows.length < orderListLimit &&
        key?.[2] === reference &&
        key[3] === status
      ) {
        return sortOrderSummaries(previousRows, sort, status);
      }
    },
    queryFn: ({ signal }) =>
      request<OrderSummary[]>(`/orders?${params}`, signal),
  });
}

export function detailQuery(reference: string) {
  return queryOptions({
    queryKey: ["orders", "detail", reference],
    queryFn: ({ signal }) =>
      request<Order>(`/orders/${encodeURIComponent(reference)}`, signal),
  });
}

export function placeOrder({
  items,
  key,
}: {
  items: DraftItem[];
  key: string;
}) {
  return request<Order>(
    "/orders",
    AbortSignal.timeout(15_000),
    "POST",
    { items },
    key,
  );
}

export function updateOrder(reference: string, status: Status) {
  return request<Order>(
    `/orders/${encodeURIComponent(reference)}/status`,
    undefined,
    "PATCH",
    { status },
  );
}
