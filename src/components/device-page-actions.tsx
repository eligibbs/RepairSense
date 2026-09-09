"use client";

import { FileUp, X } from "lucide-react";
import { useActionState, useRef } from "react";
import { importDeviceCsv } from "@/app/actions";
import { DeviceDialog, type DeviceCustomerOption } from "@/components/device-dialog";

export function DevicePageActions({ customers, defaultCustomerId }: { customers: DeviceCustomerOption[]; defaultCustomerId?: string }) {
  const [state, action, pending] = useActionState(importDeviceCsv, {});
  const dialogRef = useRef<HTMLDialogElement>(null);

  return <div className="flex gap-2">
    <button className="button-ghost border-border" onClick={() => dialogRef.current?.showModal()} type="button"><FileUp className="size-3.5" />Import CSV</button>
    <DeviceDialog customers={customers} />
    <dialog className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-lg border border-border bg-white p-0 text-foreground shadow-xl backdrop:bg-black/40" ref={dialogRef}>
      <form action={action}>
        <header className="flex items-center justify-between border-b border-border bg-zinc-50 px-panel py-2.5"><div><h2 className="text-sm font-semibold">Import NinjaOne devices</h2><p className="text-2xs text-muted">Organizations become locations; existing serials are updated.</p></div><button aria-label="Close CSV import" className="grid size-7 place-items-center rounded-md text-muted hover:bg-zinc-100" onClick={() => dialogRef.current?.close()} type="button"><X className="size-4" /></button></header>
        <div className="grid gap-3 p-4">
          <label className="grid gap-1 text-xs font-medium">Customer<select className="control" defaultValue={defaultCustomerId ?? ""} name="customerId" required><option value="">Select customer</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></label>
          <label className="grid gap-1 text-xs font-medium">NinjaOne CSV export<input accept=".csv,text/csv" className="block text-xs file:mr-3 file:h-control-sm file:rounded-md file:border file:border-border file:bg-zinc-50 file:px-2 file:text-xs file:font-semibold" name="file" required type="file" /></label>
          {state.error && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700" role="alert">{state.error}</p>}
          {state.result && <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800" role="status"><strong>{state.result.imported} devices imported.</strong><p className="mt-1 text-2xs">{state.result.created} created · {state.result.updated} updated · {state.result.duplicateRows} duplicate rows consolidated · {state.result.locationsCreated} locations created{state.result.skipped ? ` · ${state.result.skipped} skipped` : ""}</p>{state.result.errors.length > 0 && <p className="mt-1 text-2xs">{state.result.errors.join(" ")}</p>}</div>}
        </div>
        <footer className="flex justify-end gap-2 border-t border-border px-4 py-3"><button className="button-ghost border-border" onClick={() => dialogRef.current?.close()} type="button">Close</button><button className="button-primary" disabled={pending} type="submit"><FileUp className="size-3.5" />{pending ? "Importing…" : "Import devices"}</button></footer>
      </form>
    </dialog>
  </div>;
}
