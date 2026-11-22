import { Slot } from "@radix-ui/react-slot";
import type { ComponentProps } from "react";

type ButtonProps = ComponentProps<"button"> & {
  variant?: "default" | "primary" | "danger";
  asChild?: boolean;
};

export function Button({
  className,
  variant = "default",
  asChild = false,
  type = "button",
  ...props
}: ButtonProps) {
  const Component = asChild ? Slot : "button";
  const classes = [
    "button",
    variant === "default" ? undefined : variant,
    className,
  ];
  return (
    <Component
      data-slot="button"
      className={classes.filter(Boolean).join(" ")}
      type={asChild ? undefined : type}
      {...props}
    />
  );
}
