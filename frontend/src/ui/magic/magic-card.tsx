import type { ComponentProps, PointerEvent } from "react";

// Adapted from Magic UI's Magic Card (MIT). See THIRD_PARTY_NOTICES.md.
export function MagicCard({
  className = "",
  ...props
}: ComponentProps<"article">) {
  function moveSpotlight(event: PointerEvent<HTMLElement>) {
    if (event.pointerType === "touch") return;
    const card = event.currentTarget;
    const bounds = card.getBoundingClientRect();
    card.style.setProperty("--spotlight-x", `${event.clientX - bounds.left}px`);
    card.style.setProperty("--spotlight-y", `${event.clientY - bounds.top}px`);
  }

  return (
    <article
      {...props}
      className={`magic-card ${className}`}
      onPointerMove={moveSpotlight}
    />
  );
}
