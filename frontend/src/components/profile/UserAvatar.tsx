import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn, initials } from "@/lib/utils";

type Size = "sm" | "default" | "lg" | "xl";

interface UserAvatarProps {
  name: string;
  src?: string | null;
  /** `xl` (64px, 80px from `sm` up) is for profile headers. */
  size?: Size;
  className?: string;
}

/**
 * Avatar for a user, falling back to their initials.
 *
 * shadcn's `Avatar` is a bare primitive that requires `AvatarImage` and
 * `AvatarFallback` children. This wrapper applies the initials fallback, which
 * every call site in the app wants, so the composition is not repeated.
 *
 * The fallback's default `bg-muted` is #B1D3B9 inside a `light-surface`, the
 * same colour as the card, so the circle vanished. brand-600 stands out on the
 * light cards (2.1:1) and on the dark page (3.9:1), and black initials on it
 * are 6.0:1.
 *
 * 2.1:1 is a soft edge, under the 3:1 WCAG asks for a shape's outline, so
 * inside a `light-surface` card the circle also gets a ring: brand-deep at 65%
 * is 3.6:1 on the #B1D3B9 cards and 4.2:1 on #E6F2DD. The dark page needs none.
 */
export function UserAvatar({ name, src, size = "default", className }: UserAvatarProps) {
  return (
    <Avatar
      size={size}
      className={cn("in-[.light-surface]:ring-2 in-[.light-surface]:ring-brand-deep/65", className)}
    >
      {src ? <AvatarImage src={src} alt={name} /> : null}
      <AvatarFallback className="bg-brand-600 font-heading tracking-wide text-brand-ink">
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
