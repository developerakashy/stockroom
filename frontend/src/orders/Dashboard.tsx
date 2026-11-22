import { useQuery } from "@tanstack/react-query";
import { Box, Check, CircleX, PackageCheck, Truck } from "lucide-react";
import { useSearchParams } from "react-router";
import type { Status } from "../../../shared/orders";
import { orderCountsQuery } from "../api";
import { preloadProducts } from "../inventory/product-routes";
import { Recommendations } from "../inventory/Recommendations";
import { ErrorNotice } from "../ui/components";
import { CircularProgress } from "../ui/magic/circular-progress";
import { InteractiveHoverLink } from "../ui/magic/interactive-hover-link";
import { OrderDialog } from "./OrderDialog";
import { OrderList } from "./OrderList";
import { queueLabels } from "./queue-labels";

const queues = [
  { status: "Placed", icon: Box },
  { status: "Packed", icon: PackageCheck },
  { status: "Shipped", icon: Truck },
  { status: "Cancelled", icon: CircleX },
] as const;

export function Dashboard() {
  const [params, setParams] = useSearchParams();
  const counts = useQuery(orderCountsQuery);
  const total = Object.values(counts.data ?? {}).reduce(
    (sum, count) => sum + count,
    0,
  );

  function filterQueue(status: Status) {
    const next = new URLSearchParams(params);
    if (next.get("status") === status) next.delete("status");
    else next.set("status", status);
    setParams(next);
  }

  return (
    <>
      <header className="page-heading">
        <div>
          <h1>Dashboard</h1>
          <p>Track orders and manage fulfilment.</p>
        </div>
        <InteractiveHoverLink
          to="/products"
          onPointerEnter={preloadProducts}
          onFocus={preloadProducts}
        >
          Browse products
        </InteractiveHoverLink>
      </header>
      <div className="dashboard-grid">
        <div className="dashboard-main">
          <section className="panel" aria-label="Fulfilment overview">
            {counts.isError && !counts.data ? (
              <ErrorNotice
                error={counts.error}
                retry={() => void counts.refetch()}
              />
            ) : (
              <div className="overview-grid">
                {queues.map(({ status, icon: Icon }) => {
                  const active = params.get("status") === status;
                  return (
                    <button
                      type="button"
                      key={status}
                      className={`queue-metric queue-${status.toLowerCase()}`}
                      aria-pressed={active}
                      aria-description={
                        counts.data
                          ? `${counts.data[status]} of ${total} total orders`
                          : undefined
                      }
                      onClick={() => filterQueue(status)}
                    >
                      <span className="metric-label">
                        <Icon size={15} /> {queueLabels[status]}{" "}
                        {active && <Check size={14} className="metric-check" />}
                      </span>
                      <CircularProgress
                        value={counts.data?.[status]}
                        total={total}
                      />
                    </button>
                  );
                })}
              </div>
            )}
          </section>
          <OrderList />
        </div>
        <Recommendations />
      </div>
      <OrderDialog />
    </>
  );
}
