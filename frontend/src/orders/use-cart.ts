import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { catalogueQuery } from "../api";
import { useDraft } from "./draft";

export function useCart() {
  const quantities = useDraft((state) => state.quantities);
  const productIds = useDraft((state) => state.productIds);
  const catalogue = useQuery(catalogueQuery);
  const data = catalogue.data;
  const productsById = useMemo(
    () => new Map(data?.map((product) => [product.id, product])),
    [data],
  );
  const summary = useMemo(() => {
    let total = 0;
    let units = 0;
    const lines = productIds.map((productId) => {
      const quantity = quantities[productId];
      const product = productsById.get(productId);
      const subtotal = product ? product.priceCents * quantity : undefined;
      units += quantity;
      total += subtotal ?? 0;
      return {
        productId,
        quantity,
        product,
        name: product?.name ?? `Product #${productId}`,
        subtotal,
      };
    });
    return { lines, total, units };
  }, [productIds, productsById, quantities]);
  return { catalogue, ...summary };
}
