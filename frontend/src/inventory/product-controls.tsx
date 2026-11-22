import { Minus, Package, Plus, Trash2 } from "lucide-react";
import type { Product } from "../../../shared/orders";
import { useDraft } from "../orders/draft";
import { Button } from "../ui/button";
import { RippleButton } from "../ui/magic/ripple-button";

export function ProductImage({ sku }: { sku?: string }) {
  return (
    <span className="product-image">
      {sku && /^SW-10[1-6]$/.test(sku) ? (
        <img src={`/catalogue/${sku}.webp`} alt="" width={480} height={480} />
      ) : (
        <Package size={18} aria-hidden="true" />
      )}
    </span>
  );
}

export function Stock({ stock }: { stock: number }) {
  const level =
    stock === 0
      ? 0
      : stock <= 3
        ? 25
        : stock <= 5
          ? 50
          : stock <= 12
            ? 75
            : 100;
  return (
    <span className="stock">
      <span
        className="stock-meter"
        style={{ backgroundSize: `${level}% 100%` }}
        aria-hidden="true"
      />
      <span>{stock === 0 ? "Out of stock" : `${stock} left`}</span>
    </span>
  );
}

export function DraftControls({
  product,
  productId,
  name,
  onChange,
}: {
  product?: Product;
  productId: number;
  name: string;
  onChange?: () => void;
}) {
  const quantity = useDraft((state) => state.quantities[productId] ?? 0);
  const setQuantity = useDraft((state) => state.setQuantity);
  const awaitingResult = useDraft((state) => Boolean(state.placementKey));
  const atLimit =
    awaitingResult || !product || quantity >= Math.min(product.stock, 9999);
  function update(next: number) {
    setQuantity(productId, next);
    onChange?.();
  }
  return (
    <div className="draft-controls">
      {quantity > 0 && (
        <Button
          className="icon-button"
          disabled={awaitingResult}
          aria-label={`Decrease ${name} quantity`}
          onClick={() => update(quantity - 1)}
        >
          <Minus size={14} />
        </Button>
      )}
      {quantity > 0 && (
        <output aria-label={`${name} quantity`}>{quantity}</output>
      )}
      <RippleButton
        className={quantity > 0 ? "icon-button" : "add-button"}
        disabled={atLimit}
        aria-label={`Add ${name}`}
        onClick={() => update(quantity + 1)}
      >
        <Plus size={14} />
        {quantity === 0 && "Add"}
      </RippleButton>
      {quantity > 0 && (
        <Button
          className="icon-button remove-button"
          disabled={awaitingResult}
          aria-label={`Remove ${name}`}
          onClick={() => update(0)}
        >
          <Trash2 size={14} />
        </Button>
      )}
    </div>
  );
}
