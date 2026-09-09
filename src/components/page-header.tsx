import type { ReactNode } from "react";

export function PageHeader({ eyebrow, title, action }: { eyebrow: string; title: string; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div><p className="mb-0.5 text-xs font-medium uppercase tracking-wide text-muted">{eyebrow}</p><h1 className="text-xl font-semibold tracking-tight">{title}</h1></div>
      {action}
    </div>
  );
}
