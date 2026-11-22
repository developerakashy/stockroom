import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Box } from "lucide-react";
import { Link } from "react-router";
import { recommendedQuery } from "../api";
import { ErrorNotice, Loading, money } from "../ui/components";
import { DraftControls, ProductImage, Stock } from "./product-controls";

export function Recommendations() {
  const query = useQuery(recommendedQuery);
  const hasOrders = query.data?.some((product) => product.orderedUnits > 0);
  return (
    <aside
      className="panel recommendations"
      aria-labelledby="recommended-title"
    >
      <div className="panel-heading">
        <div>
          <h2 id="recommended-title">Recommended products</h2>
          <p>
            {query.isPending || hasOrders
              ? "Ranked by units ordered"
              : "Rankings appear after the first order"}
          </p>
        </div>
        <Box size={17} aria-hidden="true" />
      </div>
      {query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <ErrorNotice error={query.error} retry={() => void query.refetch()} />
      ) : (
        <ul className="recommended-list">
          {query.data.map((product) => (
            <li key={product.id}>
              <div className="product-label">
                <ProductImage sku={product.sku} />
                <span>
                  <strong>{product.name}</strong>
                  <small>
                    {money(product.priceCents)}
                    {hasOrders && ` · ${product.orderedUnits} ordered`}
                  </small>
                </span>
              </div>
              <div className="recommended-actions">
                <Stock stock={product.stock} />
                <DraftControls
                  product={product}
                  productId={product.id}
                  name={product.name}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
      <Link className="panel-link" to="/products">
        <Box size={16} /> Browse all products <ArrowRight size={15} />
      </Link>
    </aside>
  );
}
