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
        "flex flex-col items-center justify-center gap-3 rounded-xl border",
        "border-dashed border-zinc-300 bg-zinc-50 px-6 py-16 text-center",
        className,
      )}
    >
      {Icon ? <Icon aria-hidden="true" className="size-10 text-zinc-400" /> : null}
      <div className="flex flex-col gap-1">
        <p className="font-medium text-zinc-900">{title}</p>
        {description ? (
          <p className="max-w-sm text-sm text-zinc-500">{description}</p>
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
      className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
    >
      {content}
    </Link>
  );
}

