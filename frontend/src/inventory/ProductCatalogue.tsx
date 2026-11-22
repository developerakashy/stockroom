import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { useState } from "react";
import type { Product } from "../../../shared/orders";
import { catalogueQuery } from "../api";
import { ErrorNotice, Loading, money } from "../ui/components";
import { MagicCard } from "../ui/magic/magic-card";
import { DraftControls, ProductImage, Stock } from "./product-controls";

const stockFilters = [
  { id: "all", label: "All" },
  { id: "low", label: "Low stock" },
  { id: "empty", label: "Out of stock" },
] as const;

type StockFilter = (typeof stockFilters)[number]["id"];

export function ProductCatalogue() {
  const query = useQuery(catalogueQuery);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<StockFilter>("all");
  const searchTerm = search.trim().toLowerCase();
  const groups: Record<StockFilter, Product[]> = {
    all: [],
    low: [],
    empty: [],
  };
  for (const product of query.data ?? []) {
    const { name, sku, category, stock } = product;
    if (!`${name} ${sku} ${category}`.toLowerCase().includes(searchTerm))
      continue;
    groups.all.push(product);
    if (stock === 0) groups.empty.push(product);
    else if (stock <= 5) groups.low.push(product);
  }
  const matching = groups[filter];

  return (
    <section className="panel" aria-label="Product catalogue">
      <div className="filters">
        <label className="search">
          <Search size={16} />
          <input
            aria-label="Search products"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search products or SKUs…"
          />
        </label>
        <div className="stock-filters">
          {stockFilters.map((option) => (
            <button
              type="button"
              key={option.id}
              className="button stock-filter"
              aria-pressed={option.id === filter}
              onClick={() => setFilter(option.id)}
            >
              {option.label}{" "}
              <span className="count-badge">
                {query.data ? groups[option.id].length : "—"}
              </span>
            </button>
          ))}
        </div>
      </div>
      {query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <ErrorNotice error={query.error} retry={() => void query.refetch()} />
      ) : matching.length === 0 ? (
        <p className="empty">No matching products.</p>
      ) : (
        <ul className="catalogue-grid">
          {matching.map((product) => (
            <li key={product.id}>
              <MagicCard className="panel catalogue-card">
                <div className="catalogue-product">
                  <ProductImage sku={product.sku} />
                  <div className="catalogue-info">
                    <span className="muted">
                      {product.category} · {product.sku}
                    </span>
                    <h2>{product.name}</h2>
                    <Stock stock={product.stock} />
                  </div>
                </div>
                <div className="catalogue-card-footer">
                  <span className="price">{money(product.priceCents)}</span>
                  <DraftControls
                    product={product}
                    productId={product.id}
                    name={product.name}
                  />
                </div>
              </MagicCard>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
