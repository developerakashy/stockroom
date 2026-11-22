import type { CSSProperties } from "react";
import type { Status } from "../../../shared/orders";

const stages = ["Placed", "Packed", "Shipped"] as const;

export function OrderProgress({ status }: { status: Status }) {
  const reached = status === "Cancelled" ? -1 : stages.indexOf(status);
  return (
    <div className={`order-progress status-${status.toLowerCase()}`}>
      <span className="order-progress-label">{status}</span>
      <span
        className="order-progress-track"
        aria-hidden="true"
        style={
          {
            "--order-completion": Math.max(0, reached) / (stages.length - 1),
          } as CSSProperties
        }
      >
        {stages.map((stage, index) => (
          <span
            key={stage}
            className="order-progress-marker"
            data-reached={index <= reached}
          />
        ))}
      </span>
    </div>
  );
}
