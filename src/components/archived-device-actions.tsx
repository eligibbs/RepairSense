"use client";

import { RotateCcw, Trash2 } from "lucide-react";

export function ArchivedDeviceActions({
  deviceName,
  restoreAction,
  deleteAction,
}: {
  deviceName: string;
  restoreAction: () => Promise<void>;
  deleteAction: () => Promise<void>;
}) {
  return <section className="panel p-panel"><h2 className="text-sm font-semibold">Archived device</h2><p className="mt-1 text-2xs leading-4 text-muted">Restore this device to its prior state, or permanently delete it and all repair history.</p><div className="mt-3 grid grid-cols-2 gap-2"><form action={restoreAction}><button className="button-ghost w-full border-border" type="submit"><RotateCcw className="size-3.5" />Restore</button></form><form action={deleteAction} onSubmit={(event) => { if (!window.confirm(`Permanently delete ${deviceName} and all of its history? This cannot be undone.`)) event.preventDefault(); }}><button className="button-ghost w-full border-red-200 text-red-700 hover:bg-red-50" type="submit"><Trash2 className="size-3.5" />Delete</button></form></div></section>;
}
