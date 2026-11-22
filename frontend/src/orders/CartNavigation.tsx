import { ArrowRight, ShoppingCart } from "lucide-react";
import type { ReactNode } from "react";
import { Link, useLocation } from "react-router";
import { preloadProducts } from "../inventory/product-routes";
import { ErrorNotice, Loading, money } from "../ui/components";
import { cartDestination } from "./cart-destination";
import { useDraft } from "./draft";
import { OrderLinePreview } from "./OrderLinePreview";
import { useCart } from "./use-cart";

export function CartNavigation() {
  const units = useDraft((state) =>
    Object.values(state.quantities).reduce(
      (sum, quantity) => sum + quantity,
      0,
    ),
  );
  const onProducts = useLocation().pathname === "/products";
  const label = (
    <>
      <span
        className="cart-trigger-icon"
        key={`icon-${units}`}
        aria-hidden="true"
      >
        <ShoppingCart size={16} />
      </span>
      Cart{" "}
      <span className="count-badge cart-count" key={`count-${units}`}>
        {units}
      </span>
    </>
  );
  if (onProducts)
    return (
      <button className="nav-link cart-trigger" type="button" disabled>
        {label}
      </button>
    );

  return (
    <div className="cart-nav">
      <Link
        className="nav-link cart-trigger"
        to={cartDestination}
        onPointerEnter={preloadProducts}
        onFocus={preloadProducts}
      >
        {label}
      </Link>
      {units > 0 ? (
        <CartPreview />
      ) : (
        <CartPreviewPanel total={money(0)}>
          <p className="muted">Your cart is empty.</p>
        </CartPreviewPanel>
      )}
    </div>
  );
}

function CartPreview() {
  const { catalogue, lines, total } = useCart();
  return (
    <CartPreviewPanel total={catalogue.isSuccess ? money(total) : "—"}>
      {catalogue.isPending ? (
        <Loading />
      ) : catalogue.isError ? (
        <ErrorNotice error={catalogue.error} />
      ) : (
        <ul className="preview-lines">
          {lines.map(({ productId, product, name, quantity, subtotal }) => (
            <OrderLinePreview
              key={productId}
              sku={product?.sku}
              name={name}
              quantity={quantity}
              priceCents={product?.priceCents}
              subtotal={subtotal}
            />
          ))}
        </ul>
      )}
    </CartPreviewPanel>
  );
}

function CartPreviewPanel({
  children,
  total,
}: {
  children: ReactNode;
  total: string;
}) {
  return (
    <div className="panel cart-preview">
      <h2>Cart</h2>
      {children}
      <div className="preview-total">
        <strong>Total</strong>
        <strong>{total}</strong>
      </div>
      <Link className="button primary" to={cartDestination}>
        View cart <ArrowRight size={15} />
      </Link>
    </div>
  );
}
