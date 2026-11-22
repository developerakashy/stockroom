import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { useEffect } from "react";
import { Link, useLocation } from "react-router";
import { catalogueQuery } from "../api";
import { cartDestination } from "../orders/cart-destination";
import { DraftCart } from "../orders/DraftCart";
import { OrderDialog } from "../orders/OrderDialog";
import { ProductCatalogue } from "./ProductCatalogue";

export function Products() {
  const { hash, search, key } = useLocation();
  const { isPending } = useQuery(catalogueQuery);
  // biome-ignore lint/correctness/useExhaustiveDependencies: A new navigation to the same hash must refocus the cart.
  useEffect(() => {
    if (
      hash !== "#draft-cart" ||
      isPending ||
      new URLSearchParams(search).has("order")
    )
      return;
    const cart = document.getElementById("draft-cart");
    cart?.focus({ preventScroll: true });
    cart?.scrollIntoView({ block: "start" });
  }, [hash, search, key, isPending]);

  return (
    <>
      <header className="page-heading products-heading">
        <div>
          <h1>Products</h1>
          <p>Check availability and add products to an order.</p>
        </div>
        <Link className="button jump-to-cart" to={cartDestination}>
          Jump to cart <ArrowRight size={15} />
        </Link>
      </header>
      <div className="products-workspace">
        <ProductCatalogue />
        <DraftCart />
      </div>
      <OrderDialog />
    </>
  );
}
