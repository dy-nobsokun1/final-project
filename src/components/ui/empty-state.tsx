import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: { href: string; label: string };
  className?: string;
}

/** Shared placeholder for empty lists so every route looks consistent. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "light-surface flex flex-col items-center justify-center gap-3 rounded-xl border",
        "border-dashed border-input bg-card px-6 py-16 text-center",
        className,
      )}
    >
      {Icon ? <Icon aria-hidden="true" className="size-10 text-muted-foreground" /> : null}
      <div className="flex flex-col gap-1">
        <p className="font-medium text-foreground">{title}</p>
        {description ? (
          <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action ? <RenderAction action={action} /> : null}
    </div>
  );
}

function RenderAction({ action }: { action: { href: string; label: string } }) {
  const content: ReactNode = action.label;
  return (
    <Link
      href={action.href}
      className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/85"
    >
      {content}
    </Link>
  );
}

