import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Link, useParams } from "react-router";
import { catalogueQuery } from "../api";
import { useDraft } from "../orders/draft";
import { ErrorNotice, Loading, money } from "../ui/components";
import { DraftControls, ProductImage, Stock } from "./product-controls";

export function ProductDetails() {
  const { sku } = useParams();
  const query = useQuery(catalogueQuery);
  const normalizedSku = sku?.toUpperCase();
  const product = query.data?.find((item) => item.sku === normalizedSku);
  const productId = product?.id;
  const quantity = useDraft((state) =>
    productId === undefined ? 0 : (state.quantities[productId] ?? 0),
  );
  return (
    <>
      <Link className="back" to="/products">
        <ArrowLeft size={15} /> All products
      </Link>
      {query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <ErrorNotice error={query.error} retry={() => void query.refetch()} />
      ) : product ? (
        <section className="panel product-details">
          <ProductImage sku={product.sku} />
          <div>
            <p className="muted">
              {product.sku} · {product.category}
            </p>
            <h1>{product.name}</h1>
            <p className="detail-price">{money(product.priceCents)}</p>
            <div className="stock-detail">
              <Stock stock={product.stock} />
              {quantity > 0 && (
                <span className="muted">{quantity} in draft</span>
              )}
            </div>
            <DraftControls
              product={product}
              productId={product.id}
              name={product.name}
            />
          </div>
        </section>
      ) : (
        <p className="empty">Product not found.</p>
      )}
    </>
  );
}
