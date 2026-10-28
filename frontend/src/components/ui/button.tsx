"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import {
  RippleButton,
  RippleButtonRipples,
} from "@/components/animate-ui/primitives/buttons/ripple"

/**
 * Tap ripple via Animate UI's `motion`-based primitive. The variants below are
 * unchanged from the original shadcn button -- only the rendered element and the
 * ripple layer are new, so every existing `<Button>` call site animates without
 * restyling. The ripple tints to each variant's own text colour, which keeps it
 * visible on both filled and transparent backgrounds.
 */
const rippleColor: Record<string, string> = {
  default: "[--ripple-button-ripple-color:var(--primary-foreground)]",
  outline: "[--ripple-button-ripple-color:var(--foreground)]",
  secondary: "[--ripple-button-ripple-color:var(--secondary-foreground)]",
  ghost: "[--ripple-button-ripple-color:var(--foreground)]",
  destructive: "[--ripple-button-ripple-color:var(--destructive-foreground)]",
  link: "[--ripple-button-ripple-color:var(--primary-foreground)]",
}

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/80",
        outline:
          "border-border bg-background hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost:
          "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
        destructive:
          "border border-destructive/40 bg-destructive/10 text-destructive-foreground hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        icon: "size-8",
        "icon-xs":
          "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

/**
 * `motion` repurposes several DOM animation props (`onAnimationStart`,
 * `onDragStart`, ...) with incompatible signatures, so a plain
 * `React.ComponentProps<"button">` will not type-check against it. This picks
 * the props callers actually use and drops the conflicting ones.
 */
type ButtonBaseProps = Omit<
  React.ComponentProps<"button">,
  "onAnimationStart" | "onAnimationEnd" | "onAnimationIteration" | "onDragStart" | "onDragEnd" | "onDrag" | "style"
>

type ButtonProps = ButtonBaseProps &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }

/**
 * `RippleButton` types its props as a discriminated union (`WithAsChild`): the
 * `asChild: true` branch intersects `children` with a single `ReactElement`.
 * This button always appends a ripple layer, so it genuinely renders two
 * children and never satisfies that intersection. `DistributiveOmit` flattens
 * the union into one object type so the real call site type-checks; the cast is
 * local to this file and leaves the public `asChild?: boolean` API untouched.
 */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown
  ? Omit<T, K>
  : never

type RippleButtonBase = DistributiveOmit<
  React.ComponentProps<typeof RippleButton>,
  "asChild" | "children"
>

type RippleButtonLooseProps = RippleButtonBase & {
  asChild?: boolean
  children?: React.ReactNode
}

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  children,
  ...props
}: ButtonProps) {
  const Ripple = RippleButton as unknown as React.ComponentType<RippleButtonLooseProps>
  const Ripples = RippleButtonRipples as unknown as React.ComponentType

  return (
    <Ripple
      asChild={asChild}
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(
        buttonVariants({ variant, size }),
        rippleColor[variant ?? "default"],
        className,
      )}
      {...props}
    >
      {children}
      <Ripples />
    </Ripple>
  )
}

export { Button, buttonVariants }
