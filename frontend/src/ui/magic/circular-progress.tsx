import type { CSSProperties } from "react";

// Adapted from Magic UI's Animated Circular Progress Bar. See THIRD_PARTY_NOTICES.md.
export function CircularProgress({
  value,
  total,
}: {
  value: number | undefined;
  total: number;
}) {
  const share = total > 0 && value !== undefined ? (value / total) * 100 : 0;
  return (
    <span
      className="circular-progress"
      style={{ "--ring-fill": `${share}%` } as CSSProperties}
    >
      <strong>{value ?? "—"}</strong>
    </span>
  );
}
