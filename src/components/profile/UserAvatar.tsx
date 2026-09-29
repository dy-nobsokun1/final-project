import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials } from "@/lib/utils";

type Size = "sm" | "default" | "lg";

interface UserAvatarProps {
  name: string;
  src?: string | null;
  size?: Size;
  className?: string;
}

/**
 * Avatar for a user, falling back to their initials.
 *
 * shadcn's `Avatar` is a bare primitive that requires `AvatarImage` and
 * `AvatarFallback` children. This wrapper applies the initials fallback, which
 * every call site in the app wants, so the composition is not repeated.
 */
export function UserAvatar({ name, src, size = "default", className }: UserAvatarProps) {
  return (
    <Avatar size={size} className={className}>
      {src ? <AvatarImage src={src} alt={name} /> : null}
      <AvatarFallback>{initials(name)}</AvatarFallback>
    </Avatar>
  );
}

