import { lazy } from "react";

const loadOrderDetail = () => import("./OrderDetail");

export const LazyOrderDetail = lazy(() =>
  loadOrderDetail().then(({ OrderDetail }) => ({ default: OrderDetail })),
);

export function preloadOrderDetail() {
  void loadOrderDetail().catch(() => {
    // The route or dialog owns loading errors.
  });
}
