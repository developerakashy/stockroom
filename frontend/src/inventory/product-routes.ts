import { lazy } from "react";

const loadProducts = () => import("./Products");
export const ProductsRoute = lazy(() =>
  loadProducts().then(({ Products }) => ({ default: Products })),
);
export const ProductDetailsRoute = lazy(() =>
  import("./ProductDetails").then(({ ProductDetails }) => ({
    default: ProductDetails,
  })),
);

export function preloadProducts() {
  void loadProducts().catch(() => {
    // A speculative load must not surface an error before navigation.
  });
}
