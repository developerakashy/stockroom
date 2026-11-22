import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface DraftState {
  quantities: Record<number, number>;
  productIds: number[];
  placementKey: string | null;
  startPlacement: () => string;
  retryResolved: () => void;
  setQuantity: (id: number, quantity: number) => void;
  clear: () => void;
}

export const useDraft = create<DraftState>()(
  persist(
    (set, get) => ({
      quantities: {},
      productIds: [],
      placementKey: null,
      startPlacement: () => {
        const key = get().placementKey ?? crypto.randomUUID();
        set({ placementKey: key });
        return key;
      },
      retryResolved: () => set({ placementKey: null }),
      setQuantity: (id, quantity) =>
        set((state) => {
          if (state.placementKey) return state;
          const quantities = { ...state.quantities };
          if (quantity > 0) {
            quantities[id] = quantity;
            return {
              quantities,
              productIds: Object.hasOwn(state.quantities, id)
                ? state.productIds
                : [...state.productIds, id],
            };
          }
          delete quantities[id];
          return {
            quantities,
            productIds: state.productIds.filter(
              (productId) => productId !== id,
            ),
          };
        }),
      clear: () => set({ quantities: {}, productIds: [], placementKey: null }),
    }),
    {
      name: "stockroom-draft-v1",
      storage: createJSONStorage(() => sessionStorage),
      merge: (persisted, current) => {
        const saved = persisted as
          | Partial<
              Pick<DraftState, "quantities" | "productIds" | "placementKey">
            >
          | undefined;
        const quantities = saved?.quantities ?? current.quantities;
        return {
          ...current,
          quantities,
          productIds: saved?.productIds ?? Object.keys(quantities).map(Number),
          placementKey: saved?.placementKey ?? current.placementKey,
        };
      },
      partialize: (state) => ({
        quantities: state.quantities,
        productIds: state.productIds,
        placementKey: state.placementKey,
      }),
    },
  ),
);
