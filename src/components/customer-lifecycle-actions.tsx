"use client";

import { ArchiveX, RotateCcw } from "lucide-react";

export function CustomerLifecycleActions({ customerName, removed, removeAction, restoreAction }: { customerName: string; removed: boolean; removeAction: () => Promise<void>; restoreAction: () => Promise<void> }) {
  if (removed) return <form action={restoreAction} className="panel p-panel"><button className="button-ghost w-full border-border" type="submit"><RotateCcw className="size-3.5" />Restore customer</button><p className="mt-2 text-2xs text-muted">Returns the customer and its devices to active workflows.</p></form>;
  return <form action={removeAction} className="panel p-panel" onSubmit={(event) => { if (!window.confirm(`Remove ${customerName} from active workflows? Its devices and history will be retained.`)) event.preventDefault(); }}><button className="button-ghost w-full border-red-200 text-red-700 hover:bg-red-50" type="submit"><ArchiveX className="size-3.5" />Remove customer</button><p className="mt-2 text-2xs text-muted">Customers with open repairs cannot be removed.</p></form>;
}
