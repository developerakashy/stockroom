import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { AlertCircle, LoaderCircle } from "lucide-react";
import type { ReactNode } from "react";
import type { Status } from "../../../shared/orders";
import { Button } from "./button";

const currency = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
});
const date = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

export function money(cents: number) {
  return currency.format(cents / 100);
}
export function formatDate(value: string) {
  return date.format(new Date(value));
}

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={`badge status-${status.toLowerCase()}`}>
      <span className="status-dot" />
      {status}
    </span>
  );
}

export function Loading() {
  return (
    <div className="empty" role="status">
      <LoaderCircle className="animate-spin" size={21} /> Loading…
    </div>
  );
}

export function ErrorNotice({
  error,
  retry,
}: {
  error: unknown;
  retry?: () => void;
}) {
  return (
    <div className="notice error" role="alert">
      <AlertCircle size={18} />
      <span>
        {error instanceof Error
          ? error.message
          : "Something went wrong. Please try again."}
      </span>
      {retry && <Button onClick={retry}>Retry</Button>}
    </div>
  );
}

export function Confirm({
  trigger,
  title,
  description,
  action,
  onConfirm,
}: {
  trigger: ReactNode;
  title: string;
  description: string;
  action: string;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog.Root>
      <AlertDialog.Trigger asChild>{trigger}</AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="dialog-overlay" />
        <AlertDialog.Content className="dialog">
          <AlertDialog.Title>{title}</AlertDialog.Title>
          <AlertDialog.Description>{description}</AlertDialog.Description>
          <div className="dialog-actions">
            <AlertDialog.Cancel asChild>
              <Button>Go back</Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <Button variant="danger" onClick={onConfirm}>
                {action}
              </Button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
