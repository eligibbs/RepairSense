"use client";

import { Recycle } from "lucide-react";

export function DisposeDeviceForm({ action, deviceName }: { action: (formData: FormData) => Promise<void>; deviceName: string }) {
  return <form action={action} className="panel">
    <div className="border-b border-border px-panel py-2.5"><h2 className="text-sm font-semibold">No return disposition</h2><p className="text-2xs text-muted">Close this intake without returning the device to the customer.</p></div>
    <div className="grid gap-3 p-panel">
      <label className="grid gap-1 text-xs font-medium">Reason / notes<textarea className="min-h-20 rounded-md border border-border px-2.5 py-2 text-xs" name="dispositionNotes" placeholder="Optional history note" /></label>
      <button className="button-ghost border-amber-200 text-amber-700 hover:bg-amber-50" name="disposition" onClick={(event) => { if (!window.confirm(`Mark ${deviceName} as recycled? This closes the intake and removes it from active customer devices.`)) event.preventDefault(); }} type="submit" value="RECYCLED"><Recycle className="size-3.5" />Recycle device</button>
    </div>
  </form>;
}
