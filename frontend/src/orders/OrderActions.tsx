import {
  useIsMutating,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { LoaderCircle, X } from "lucide-react";
import {
  type OrderSort,
  type OrderSummary,
  orderListLimit,
  orderSorts,
  type Status,
  sortOrderSummaries,
} from "../../../shared/orders";
import { ApiError, detailQuery, updateOrder } from "../api";
import { Button } from "../ui/button";
import { Confirm } from "../ui/components";

const orderListKey = ["orders", "list"] as const;

function updateList(
  entries: OrderSummary[],
  order: OrderSummary,
  search: string,
  status: string,
  requestedSort?: OrderSort,
) {
  const next = entries.filter((entry) => entry.reference !== order.reference);
  if (
    !order.reference.includes(search.toUpperCase()) ||
    (status && order.status !== status)
  )
    return next;
  return sortOrderSummaries([...next, order], requestedSort, status).slice(
    0,
    orderListLimit,
  );
}

export function useOrderStatus(
  reference: string,
  onChanged?: (status: Status) => void,
) {
  const client = useQueryClient();
  return useMutation({
    mutationKey: ["order-status", reference],
    mutationFn: (status: Status) => updateOrder(reference, status),
    onSuccess: async (order) => {
      const detailKey = detailQuery(reference).queryKey;
      await Promise.all([
        client.cancelQueries({ queryKey: orderListKey }),
        client.cancelQueries({ queryKey: detailKey, exact: true }),
      ]);
      client.setQueryData(detailKey, order);
      const {
        reference: orderRef,
        status,
        createdAt,
        totalCents,
        units,
      } = order;
      const summary = {
        reference: orderRef,
        status,
        createdAt,
        totalCents,
        units,
      };
      for (const [key] of client.getQueriesData({ queryKey: orderListKey })) {
        const [, , search, filter, cachedSort] = key;
        if (typeof search !== "string" || typeof filter !== "string") continue;
        const sort = orderSorts.find((value) => value === cachedSort);
        client.setQueryData<OrderSummary[]>(
          key,
          (entries) =>
            entries && updateList(entries, summary, search, filter, sort),
        );
      }
      void client.invalidateQueries({ queryKey: ["orders"] });
      if (order.status === "Cancelled")
        void client.invalidateQueries({ queryKey: ["products"] });
      onChanged?.(order.status);
    },
    onError: (error) => {
      if (error instanceof ApiError && error.code === "INVALID_TRANSITION") {
        void client.invalidateQueries({ queryKey: ["orders"] });
        void client.invalidateQueries({ queryKey: ["products"] });
      }
    },
  });
}

export function OrderActions({
  order,
  onChange,
  compact = false,
}: {
  order: OrderSummary;
  onChange: (status: Status) => void;
  compact?: boolean;
}) {
  const pending =
    useIsMutating({ mutationKey: ["order-status", order.reference] }) > 0;
  const next =
    order.status === "Placed"
      ? "Packed"
      : order.status === "Packed"
        ? "Shipped"
        : undefined;
  if (!next) return null;
  const label = compact
    ? next === "Packed"
      ? "Pack"
      : "Ship"
    : `Mark as ${next.toLowerCase()}`;
  return (
    <div className="order-actions">
      <Button
        className="order-action-primary"
        disabled={pending}
        aria-busy={pending}
        variant={compact ? "default" : "primary"}
        onClick={() => onChange(next)}
      >
        <span
          className={
            pending ? "order-action-label pending" : "order-action-label"
          }
        >
          {label}
        </span>
        {pending && (
          <LoaderCircle
            className="order-action-spinner animate-spin"
            size={14}
            aria-hidden="true"
          />
        )}
      </Button>
      <Confirm
        trigger={
          <Button
            className={compact ? "icon-button cancel-action" : "cancel-action"}
            disabled={pending}
            aria-label="Cancel order"
            title={compact ? "Cancel order" : undefined}
          >
            {compact ? <X size={16} /> : "Cancel order"}
          </Button>
        }
        title="Cancel this order?"
        description={`${order.reference} will be cancelled and its units returned to stock.`}
        action="Cancel order"
        onConfirm={() => onChange("Cancelled")}
      />
    </div>
  );
}
