import { BadgeCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface VerifiedBadgeProps {
  isVerified: boolean;
  className?: string;
}

/** Small verified tick. Renders nothing for unverified accounts. */
export function VerifiedBadge({ isVerified, className }: VerifiedBadgeProps) {
  if (!isVerified) return null;

  return (
    <span
      title="Verified student"
      className={cn("inline-flex items-center text-sky-600", className)}
    >
      <BadgeCheck aria-label="Verified student" className="size-4" />
    </span>
  );
}

