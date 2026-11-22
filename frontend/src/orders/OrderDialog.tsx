import * as Dialog from "@radix-ui/react-dialog";
import { ArrowRight, X } from "lucide-react";
import { Suspense, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { Button } from "../ui/button";
import { Loading } from "../ui/components";
import { LazyOrderDetail } from "./lazy-order-detail";

export function OrderDialog() {
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const reference = params.get("order");
  const confirmation = location.state?.placed === true;
  const [lastOrder, setLastOrder] = useState<{
    reference: string;
    confirmation: boolean;
  } | null>(null);

  // Keep the order content available while Radix plays the closing animation.
  if (
    reference &&
    (lastOrder?.reference !== reference ||
      lastOrder.confirmation !== confirmation)
  ) {
    setLastOrder({ reference, confirmation });
  }
  const displayedOrder = reference ? { reference, confirmation } : lastOrder;
  if (!displayedOrder) return null;

  return (
    <Dialog.Root
      open={Boolean(reference)}
      onOpenChange={(open) => {
        if (open) return;
        params.delete("order");
        navigate(
          {
            pathname: location.pathname,
            search: params.toString(),
            hash: location.hash,
          },
          { replace: true },
        );
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay detail-overlay" />
        <Dialog.Content className="detail-dialog" aria-describedby={undefined}>
          <Dialog.Title>
            {displayedOrder.confirmation
              ? "Order confirmation"
              : "Order details"}
          </Dialog.Title>
          <Dialog.Close asChild>
            <Button
              className="detail-close icon-button"
              aria-label="Close order details"
            >
              <X size={18} />
            </Button>
          </Dialog.Close>
          <Suspense fallback={<Loading />}>
            <LazyOrderDetail
              key={displayedOrder.reference}
              selected={displayedOrder.reference}
              placed={displayedOrder.confirmation}
            />
          </Suspense>
          {displayedOrder.confirmation && (
            <footer className="order-confirmation-actions">
              <Button asChild variant="primary">
                <Link to="/">
                  Go to dashboard <ArrowRight size={15} />
                </Link>
              </Button>
            </footer>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
