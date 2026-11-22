import { type ComponentProps, type MouseEvent, useRef, useState } from "react";
import { Button } from "../button";

interface Ripple {
  id: number;
  x: number;
  y: number;
  size: number;
}

// Adapted from Magic UI's Ripple Button (MIT). See THIRD_PARTY_NOTICES.md.
export function RippleButton({
  className = "",
  children,
  onClick,
  ...props
}: Omit<ComponentProps<typeof Button>, "asChild">) {
  const [ripple, setRipple] = useState<Ripple>();
  const nextId = useRef(0);

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const bounds = event.currentTarget.getBoundingClientRect();
      const pointer = event.detail > 0;
      const x = pointer ? event.clientX - bounds.left : bounds.width / 2;
      const y = pointer ? event.clientY - bounds.top : bounds.height / 2;
      const size =
        2 *
        Math.hypot(
          Math.max(x, bounds.width - x),
          Math.max(y, bounds.height - y),
        );
      nextId.current += 1;
      setRipple({ id: nextId.current, x, y, size });
    }
    onClick?.(event);
  }

  return (
    <Button
      {...props}
      className={`ripple-button ${className}`}
      onClick={handleClick}
    >
      <span className="ripple-button-content">{children}</span>
      {ripple && (
        <span
          key={ripple.id}
          className="button-ripple"
          aria-hidden="true"
          style={{
            width: ripple.size,
            height: ripple.size,
            left: ripple.x,
            top: ripple.y,
          }}
          onAnimationEnd={() =>
            setRipple((current) =>
              current?.id === ripple.id ? undefined : current,
            )
          }
        />
      )}
    </Button>
  );
}
