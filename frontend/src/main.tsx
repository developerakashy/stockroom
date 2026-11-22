import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import { Box, Boxes, LayoutDashboard } from "lucide-react";
import { StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter,
  Link,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
} from "react-router";
import { ApiError, catalogueQuery } from "./api";
import {
  ProductDetailsRoute,
  ProductsRoute,
  preloadProducts,
} from "./inventory/product-routes";
import { CartNavigation } from "./orders/CartNavigation";
import { cartDestination } from "./orders/cart-destination";
import { Dashboard } from "./orders/Dashboard";
import { LazyOrderDetail } from "./orders/lazy-order-detail";
import { Loading } from "./ui/components";
import "./styles.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (count, error) => !(error instanceof ApiError) && count < 1,
    },
  },
});

const selectProductCount = (products: readonly unknown[]) => products.length;

function ProductCount() {
  const { data: count } = useQuery({
    ...catalogueQuery,
    select: selectProductCount,
  });
  return count === undefined ? null : (
    <span className="count-badge product-count" aria-hidden="true">
      {count}
    </span>
  );
}

function Shell() {
  const { pathname } = useLocation();
  return (
    <>
      <header className="topbar">
        <div className="shell topbar-inner">
          <Link to="/" className="brand">
            <span className="brand-mark">
              <Boxes size={23} />
            </span>{" "}
            Stockroom
          </Link>
          <nav aria-label="Main navigation">
            <div
              className="main-tabs"
              data-active={
                pathname.startsWith("/products") ? "products" : "dashboard"
              }
            >
              <Link
                className="nav-link"
                to="/"
                aria-current={
                  pathname === "/" || pathname.startsWith("/orders")
                    ? "page"
                    : undefined
                }
              >
                <LayoutDashboard size={16} /> Dashboard
              </Link>
              <Link
                className="nav-link"
                to="/products"
                onPointerEnter={preloadProducts}
                onFocus={preloadProducts}
                aria-current={
                  pathname.startsWith("/products") ? "page" : undefined
                }
              >
                <Box size={16} /> Products
                <ProductCount />
              </Link>
            </div>
            <CartNavigation />
          </nav>
        </div>
      </header>
      <main key={pathname} className="shell main-content page-enter">
        <Suspense fallback={<Loading />}>
          <Outlet />
        </Suspense>
      </main>
    </>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("Missing application root.");

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<Shell />}>
            <Route index element={<Dashboard />} />
            <Route path="orders" element={<Dashboard />} />
            <Route
              path="orders/new"
              element={<Navigate to="/products" replace />}
            />
            <Route path="products" element={<ProductsRoute />} />
            <Route path="products/:sku" element={<ProductDetailsRoute />} />
            <Route
              path="cart"
              element={<Navigate to={cartDestination} replace />}
            />
            <Route path="orders/:reference" element={<LazyOrderDetail />} />
            <Route
              path="*"
              element={
                <div className="empty">
                  <h1>Page not found</h1>
                  <Link to="/orders" className="button">
                    Back to orders
                  </Link>
                </div>
              }
            />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
