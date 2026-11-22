import { useQuery } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowDownUp,
  ArrowUp,
  ArrowUpRight,
  ClipboardList,
  Search,
  X,
} from "lucide-react";
import { memo, useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import {
  type OrderSort,
  type OrderSummary,
  orderSorts,
  resolveOrderSort,
  type Status,
  statuses,
} from "../../../shared/orders";
import { ordersQuery } from "../api";
import { Button } from "../ui/button";
import { ErrorNotice, formatDate, Loading, money } from "../ui/components";
import { FilterSelect } from "../ui/filter-select";
import { preloadOrderDetail } from "./lazy-order-detail";
import { OrderActions, useOrderStatus } from "./OrderActions";
import { OrderProgress } from "./OrderProgress";
import { queueLabels } from "./queue-labels";

const sortLabels: Record<OrderSort, string> = {
  newest: "Newest first",
  oldest: "Oldest first",
  "highest-total": "Highest total",
  "lowest-total": "Lowest total",
  "most-units": "Most units",
  "fewest-units": "Fewest units",
};

function SortableHeading({
  label,
  ascending,
  descending,
  current,
  onSort,
  numeric = false,
}: {
  label: string;
  ascending: OrderSort;
  descending: OrderSort;
  current: OrderSort;
  onSort: (sort: OrderSort) => void;
  numeric?: boolean;
}) {
  const direction =
    current === ascending
      ? "ascending"
      : current === descending
        ? "descending"
        : undefined;
  const Icon =
    direction === "ascending"
      ? ArrowUp
      : direction === "descending"
        ? ArrowDown
        : ArrowDownUp;
  return (
    <th
      scope="col"
      aria-sort={direction}
      className={numeric ? "number" : undefined}
    >
      <button
        type="button"
        className="sortable-heading"
        onClick={() =>
          onSort(direction === "descending" ? ascending : descending)
        }
      >
        {label} <Icon size={13} aria-hidden="true" />
      </button>
    </th>
  );
}

const placedTime = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
});

function elapsedSince(timestamp: string, now: number) {
  const minutes = Math.max(
    0,
    Math.floor((now - Date.parse(timestamp)) / 60_000),
  );
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours} hr ago` : `${Math.floor(hours / 24)}d ago`;
}

const OrderRow = memo(function OrderRow({
  order,
  url,
  onChanged,
  age,
}: {
  order: OrderSummary;
  url: string;
  onChanged: (reference: string, status: Status) => void;
  age: string;
}) {
  const mutation = useOrderStatus(order.reference, (status) =>
    onChanged(order.reference, status),
  );
  const date = formatDate(order.createdAt);
  return (
    <>
      <tr>
        <td>
          <Link
            className="order-reference"
            to={url}
            onPointerEnter={preloadOrderDetail}
            onFocus={preloadOrderDetail}
          >
            {order.reference}
            <ArrowUpRight size={13} />
          </Link>
        </td>
        <td>
          <time
            dateTime={order.createdAt}
            title={`${date} · ${placedTime.format(new Date(order.createdAt))}`}
          >
            <strong className="order-age">{age}</strong>
            <small>{date}</small>
          </time>
        </td>
        <td>
          <OrderProgress status={order.status} />
        </td>
        <td className="number">{order.units}</td>
        <td className="number price">{money(order.totalCents)}</td>
        <td className="order-actions-column">
          <OrderActions order={order} onChange={mutation.mutate} compact />
        </td>
      </tr>
      {mutation.isError && (
        <tr>
          <td colSpan={6}>
            <ErrorNotice error={mutation.error} />
          </td>
        </tr>
      )}
    </>
  );
});

export function OrderList() {
  const [params, setParams] = useSearchParams();
  const [feedback, setFeedback] = useState("");
  const [now, setNow] = useState(Date.now);
  const reportStatus = useCallback((reference: string, status: Status) => {
    setFeedback(
      status === "Cancelled"
        ? `${reference} cancelled. Stock restored.`
        : `${reference} marked as ${status.toLowerCase()}.`,
    );
  }, []);
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(interval);
  }, []);
  const search = params.get("search") ?? "";
  const rawStatus = params.get("status") as Status;
  const status = statuses.includes(rawStatus) ? rawStatus : "";
  const sort = orderSorts.find((value) => value === params.get("sort"));
  const query = useQuery(ordersQuery(search, status, sort));
  const defaultSort = resolveOrderSort(undefined, status);

  function setFilter(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: key === "search" });
  }

  return (
    <section className="panel order-list" aria-labelledby="orders-heading">
      <div className="filters order-filters">
        <div className="search order-search">
          <Search size={16} />
          <input
            aria-label="Search by order reference"
            placeholder="Search by reference…"
            maxLength={32}
            value={search}
            onChange={(event) => setFilter("search", event.target.value)}
          />
          {search && (
            <button
              type="button"
              className="inline-filter-clear"
              aria-label="Clear search"
              title="Clear search"
              onClick={() => setFilter("search", "")}
            >
              <X size={14} aria-hidden="true" />
            </button>
          )}
        </div>
        <div className="order-filter-controls">
          <div className="filter-status">
            <label id="orders-status-label" htmlFor="orders-status">
              Status
            </label>
            <FilterSelect
              id="orders-status"
              labelId="orders-status-label"
              className="order-status-trigger"
              clear={
                status
                  ? {
                      label: "Clear status filter",
                      onClick: () => setFilter("status", ""),
                    }
                  : undefined
              }
              value={status || "all"}
              options={[
                { value: "all", label: "All statuses" },
                ...statuses.map((value) => ({
                  value,
                  label: queueLabels[value],
                })),
              ]}
              onChange={(value) =>
                setFilter("status", value === "all" ? "" : value)
              }
            />
          </div>
          <div className="filter-status order-sort">
            <label id="orders-sort-label" htmlFor="orders-sort">
              <ArrowDownUp size={14} aria-hidden="true" /> Sort by
            </label>
            <FilterSelect
              id="orders-sort"
              labelId="orders-sort-label"
              className="order-sort-trigger"
              value={sort ?? "default"}
              clear={
                sort
                  ? {
                      label: "Clear sort",
                      onClick: () => setFilter("sort", ""),
                    }
                  : undefined
              }
              options={[
                {
                  value: "default",
                  label: `Default (${sortLabels[defaultSort].toLowerCase()})`,
                },
                ...orderSorts.map((value) => ({
                  value,
                  label: sortLabels[value],
                })),
              ]}
              onChange={(value) =>
                setFilter("sort", value === "default" ? "" : value)
              }
            />
          </div>
        </div>
      </div>
      {
        // biome-ignore lint/a11y/noNoninteractiveTabindex: The overflow region needs keyboard scrolling.
        <section className="table-scroll" aria-label="Order table" tabIndex={0}>
          <table>
            <thead>
              <tr>
                <th>Reference</th>
                <SortableHeading
                  label="Placed"
                  ascending="oldest"
                  descending="newest"
                  current={sort ?? defaultSort}
                  onSort={(value) => setFilter("sort", value)}
                />
                <th>Progress</th>
                <SortableHeading
                  label="Units"
                  ascending="fewest-units"
                  descending="most-units"
                  current={sort ?? defaultSort}
                  onSort={(value) => setFilter("sort", value)}
                  numeric
                />
                <SortableHeading
                  label="Total"
                  ascending="lowest-total"
                  descending="highest-total"
                  current={sort ?? defaultSort}
                  onSort={(value) => setFilter("sort", value)}
                  numeric
                />
                <th className="order-actions-column">Actions</th>
              </tr>
            </thead>
            <tbody>
              {!query.data?.length && (
                <tr>
                  <td colSpan={6} className="order-table-state">
                    {query.isPending ? (
                      <Loading />
                    ) : query.isError && !query.data ? (
                      <ErrorNotice
                        error={query.error}
                        retry={() => void query.refetch()}
                      />
                    ) : (
                      <div className="empty">
                        <ClipboardList size={24} />
                        <h3>
                          {search || status
                            ? "No matching orders"
                            : "No orders yet"}
                        </h3>
                        {!(search || status) && (
                          <p>Orders appear here after placement.</p>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              )}
              {query.data?.map((order) => {
                const next = new URLSearchParams(params);
                next.set("order", order.reference);
                return (
                  <OrderRow
                    key={order.reference}
                    order={order}
                    age={elapsedSince(order.createdAt, now)}
                    url={`?${next}`}
                    onChanged={reportStatus}
                  />
                );
              })}
            </tbody>
          </table>
        </section>
      }
      <section className="order-count-dock" aria-label="Order count">
        {feedback && (
          <div className="list-feedback">
            <span role="status">{feedback}</span>
            <Button
              className="icon-button"
              aria-label="Dismiss update"
              onClick={() => setFeedback("")}
            >
              ×
            </Button>
          </div>
        )}
        <h2 id="orders-heading">Orders</h2>
        <span className="muted">
          {query.data
            ? `${query.data.length} ${query.data.length === 1 ? "order" : "orders"}`
            : "—"}
        </span>
      </section>
    </section>
  );
}
