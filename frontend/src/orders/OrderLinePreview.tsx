import { ProductImage } from "../inventory/product-controls";
import { money } from "../ui/components";

export function OrderLinePreview({
  sku,
  name,
  quantity,
  priceCents,
  subtotal,
}: {
  sku?: string;
  name: string;
  quantity: number;
  priceCents?: number;
  subtotal?: number;
}) {
  return (
    <li>
      <ProductImage sku={sku} />
      <div>
        <strong>{name}</strong>
        <small>
          {quantity} × {priceCents === undefined ? "—" : money(priceCents)}
        </small>
      </div>
      <span className="price">
        {subtotal === undefined ? "—" : money(subtotal)}
      </span>
    </li>
  );
}
