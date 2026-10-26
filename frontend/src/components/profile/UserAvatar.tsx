import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials } from "@/lib/utils";

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
 */
export function UserAvatar({ name, src, size = "default", className }: UserAvatarProps) {
  return (
    <Avatar size={size} className={className}>
      {src ? <AvatarImage src={src} alt={name} /> : null}
      <AvatarFallback className="bg-brand-600 font-heading tracking-wide text-brand-ink">
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
