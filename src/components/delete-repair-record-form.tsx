"use client";

import { Trash2 } from "lucide-react";

export function DeleteRepairRecordForm({ action, intakeNumber }: { action: () => Promise<void>; intakeNumber: string }) {
  return <form action={action} className="panel p-panel" onSubmit={(event) => { if (!window.confirm(`Permanently delete repair record ${intakeNumber}? This cannot be undone.`)) event.preventDefault(); }}><button className="button-ghost w-full border-red-200 text-red-700 hover:bg-red-50" type="submit"><Trash2 className="size-3.5" />Delete repair record</button><p className="mt-2 text-2xs leading-4 text-muted">Available only because this pickup was removed. The device itself will remain.</p></form>;
}
