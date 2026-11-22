import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Check, PackageCheck } from "lucide-react";
import { useMemo } from "react";
import { Link, useParams } from "react-router";
import type { Status } from "../../../shared/orders";
import { catalogueQuery, detailQuery } from "../api";
import {
  ErrorNotice,
  formatDate,
  Loading,
  money,
  StatusBadge,
} from "../ui/components";
import { OrderActions, useOrderStatus } from "./OrderActions";
import { OrderLinePreview } from "./OrderLinePreview";

const timelineDate = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});
const progress: readonly Status[] = ["Placed", "Packed", "Shipped"];

export function OrderDetail({
  selected,
  placed = false,
}: {
  selected?: string;
  placed?: boolean;
}) {
  const routeReference = useParams().reference;
  const reference = (selected ?? routeReference ?? "").toUpperCase();
  const query = useQuery(detailQuery(reference));
  const { data: catalogue } = useQuery(catalogueQuery);
  const skuById = useMemo(
    () => new Map(catalogue?.map(({ id, sku }) => [id, sku])),
    [catalogue],
  );
  const mutation = useOrderStatus(reference);

  const back = selected ? null : (
    <Link to="/orders" className="back">
      <ArrowLeft size={16} /> All orders
    </Link>
  );
  if (query.isPending)
    return (
      <>
        {back}
        <Loading />
      </>
    );
  if (query.isError && !query.data)
    return (
      <>
        {back}
        <ErrorNotice error={query.error} retry={() => void query.refetch()} />
      </>
    );

  const order = query.data;
  const events = [
    { status: "Placed", at: order.createdAt },
    { status: "Packed", at: order.packedAt },
    { status: "Shipped", at: order.shippedAt },
  ] as const;
  const steps =
    order.status === "Cancelled"
      ? [
          ...events.filter(({ at }) => at !== null),
          { status: "Cancelled", at: order.cancelledAt },
        ]
      : events;
  const reached = progress.indexOf(order.status);
  const confirmed = placed;
  const Heading = selected ? "h2" : "h1";

  return (
    <div className="detail-body">
      {back}
      <header className="detail-header">
        {confirmed && (
          <span className="confirmation-mark">
            <Check size={23} />
          </span>
        )}
        <Heading>{confirmed ? "Order confirmed" : order.reference}</Heading>
        <p>
          {confirmed ? <>{order.reference} · </> : null}Placed{" "}
          {formatDate(order.createdAt)}
        </p>
        <StatusBadge status={order.status} />
      </header>
      <section className="detail-items panel" aria-label="Order items">
        <ul className="preview-lines">
          {order.items.map((item) => (
            <OrderLinePreview
              key={item.productId}
              sku={skuById.get(item.productId)}
              name={item.name}
              quantity={item.quantity}
              priceCents={item.unitPriceCents}
              subtotal={item.quantity * item.unitPriceCents}
            />
          ))}
        </ul>
        <div className="preview-total">
          <span>Order total</span>
          <strong>{money(order.totalCents)}</strong>
        </div>
      </section>
      <section
        className="panel detail-fulfilment"
        aria-labelledby="fulfilment-title"
      >
        <h2 id="fulfilment-title">
          <PackageCheck size={17} /> Fulfilment
        </h2>
        <ol className="steps" aria-label="Fulfilment timeline">
          {steps.map(({ status, at }, index) => {
            const complete = order.status === "Cancelled" || index <= reached;
            return (
              <li
                key={status}
                className={
                  complete
                    ? index < steps.length - 1 &&
                      (order.status === "Cancelled" || index < reached)
                      ? "reached linked"
                      : "reached"
                    : ""
                }
                aria-current={status === order.status ? "step" : undefined}
              >
                <span>
                  {complete ? (
                    <Check className="timeline-check" size={12} />
                  ) : (
                    <span className="step-dot" />
                  )}
                </span>
                <div>
                  <strong>{status}</strong>
                  {at ? (
                    <time dateTime={at}>
                      {timelineDate.format(new Date(at))}
                    </time>
                  ) : (
                    <small>{complete ? "Time unavailable" : "Pending"}</small>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
        {order.status === "Cancelled" && (
          <p>Order cancelled and stock restored.</p>
        )}
        {mutation.isError && <ErrorNotice error={mutation.error} />}
        {mutation.isSuccess && order.status !== "Cancelled" && (
          <p className="sr-only" role="status">
            Order marked as {order.status.toLowerCase()}.
          </p>
        )}
        <div className="detail-actions">
          <OrderActions order={order} onChange={mutation.mutate} />
        </div>
      </section>
    </div>
  );
}
