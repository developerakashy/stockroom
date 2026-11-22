import { ArrowRight } from "lucide-react";
import type { ComponentProps } from "react";
import { Link } from "react-router";

type Props = Omit<ComponentProps<typeof Link>, "children"> & {
  children: string;
};

// Adapted from Magic UI's Interactive Hover Button.
export function InteractiveHoverLink({
  className = "",
  children,
  ...props
}: Props) {
  return (
    <Link {...props} className={`button interactive-hover ${className}`}>
      <span className="interactive-hover-fill" aria-hidden="true" />
      <span className="interactive-hover-idle">{children}</span>
      <span className="interactive-hover-active" aria-hidden="true">
        {children} <ArrowRight size={15} />
      </span>
    </Link>
  );
}
