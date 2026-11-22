import {
  useIsMutating,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { ArrowRight, ShoppingCart, TriangleAlert } from "lucide-react";
import { useLocation, useNavigate } from "react-router";
import { ApiError, detailQuery, placeOrder } from "../api";
import { DraftControls, ProductImage } from "../inventory/product-controls";
import { Button } from "../ui/button";
import { Confirm, ErrorNotice, Loading, money } from "../ui/components";
import { RippleButton } from "../ui/magic/ripple-button";
import { useDraft } from "./draft";
import { useCart } from "./use-cart";

export function DraftCart() {
  const { catalogue, lines, total, units } = useCart();
  const clear = useDraft((state) => state.clear);
  const setQuantity = useDraft((state) => state.setQuantity);
  const placementKey = useDraft((state) => state.placementKey);
  const startPlacement = useDraft((state) => state.startPlacement);
  const retryResolved = useDraft((state) => state.retryResolved);
  const client = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const mutation = useMutation({
    mutationKey: ["place-order"],
    mutationFn: placeOrder,
    onSuccess: (order) => {
      clear();
      client.setQueryData(detailQuery(order.reference).queryKey, order);
      void client.invalidateQueries({ queryKey: ["products"] });
      void client.invalidateQueries({ queryKey: ["orders"] });
      const params = new URLSearchParams(location.search);
      params.set("order", order.reference);
      navigate(
        {
          pathname: "/products",
          search: params.toString(),
          hash: location.hash,
        },
        { replace: true, state: { placed: true } },
      );
    },
    onError: (error) => {
      if (
        error instanceof ApiError &&
        (error.status === 400 || error.code === "INSUFFICIENT_STOCK")
      ) {
        retryResolved();
      }
      void client.invalidateQueries({ queryKey: ["products"] });
    },
  });
  const submitting = useIsMutating({ mutationKey: ["place-order"] }) > 0;
  const unavailable = lines.some(
    ({ quantity, product }) => !product || quantity > product.stock,
  );
  return (
    <section
      className="panel draft-cart"
      id="draft-cart"
      aria-labelledby="cart-heading"
      tabIndex={-1}
    >
      <header className="panel-heading">
        <h2 id="cart-heading">
          <ShoppingCart size={16} /> Order summary
        </h2>
        <span className="muted">
          {units} {units === 1 ? "unit" : "units"}
        </span>
      </header>
      <div className="draft-cart-body">
        {catalogue.isPending && !placementKey ? (
          <Loading />
        ) : catalogue.isError && !placementKey ? (
          <ErrorNotice
            error={catalogue.error}
            retry={() => void catalogue.refetch()}
          />
        ) : !units ? (
          <div className="empty">
            <ShoppingCart size={23} />
            <p>Your cart is empty.</p>
          </div>
        ) : (
          <ul className="cart-lines">
            {lines.map(({ productId, product, name, quantity, subtotal }) => (
              <li key={productId} className="cart-line-enter">
                <div className="cart-line-info">
                  <div className="product-label">
                    <ProductImage sku={product?.sku} />
                    <span>
                      <strong>{name}</strong>
                      <small>
                        {product
                          ? `${quantity} × ${money(product.priceCents)}`
                          : `${quantity} · Unavailable`}
                      </small>
                    </span>
                  </div>
                  <strong className="price">
                    {subtotal === undefined ? "—" : money(subtotal)}
                  </strong>
                </div>
                <div className="cart-line-controls">
                  <DraftControls
                    product={product}
                    productId={productId}
                    name={name}
                    onChange={mutation.reset}
                  />
                </div>
                {product && quantity > product.stock && (
                  <div className="line-error stock-resolution">
                    <span className="stock-warning-label">
                      <TriangleAlert size={14} aria-hidden="true" />
                      {product.stock === 0
                        ? "Out of stock"
                        : `Requested ${quantity} · Available ${product.stock}`}
                    </span>
                    {product.stock > 0 && (
                      <Button
                        disabled={Boolean(placementKey)}
                        onClick={() => {
                          setQuantity(productId, product.stock);
                          mutation.reset();
                        }}
                      >
                        Reduce to {product.stock}
                      </Button>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="cart-summary">
        <div className="cart-total">
          <span>Total</span>
          <strong>{catalogue.isSuccess ? money(total) : "—"}</strong>
        </div>
        {mutation.isError && <ErrorNotice error={mutation.error} />}
        {placementKey && !submitting && (
          <p className="muted" role="status">
            Checkout is unconfirmed. Retry to check whether it was saved. Cart
            edits are paused until checkout is resolved.
          </p>
        )}
        <RippleButton
          variant="primary"
          disabled={!units || (!placementKey && unavailable) || submitting}
          onClick={() => {
            const key = startPlacement();
            mutation.mutate({
              key,
              items: lines.map(({ productId, quantity }) => ({
                productId,
                quantity,
              })),
            });
          }}
        >
          {submitting
            ? "Placing order…"
            : placementKey
              ? "Retry checkout"
              : "Place order"}{" "}
          <ArrowRight size={15} />
        </RippleButton>
        {!!units && (
          <Confirm
            trigger={
              <Button disabled={Boolean(placementKey)}>Discard draft</Button>
            }
            title="Discard this draft?"
            description="All items will be removed from the cart."
            action="Discard draft"
            onConfirm={() => {
              clear();
              mutation.reset();
            }}
          />
        )}
      </div>
    </section>
  );
}
