import type { Status } from "../../../shared/orders";

export const queueLabels: Record<Status, string> = {
  Placed: "To pack",
  Packed: "Ready to ship",
  Shipped: "Shipped",
  Cancelled: "Cancelled",
};
