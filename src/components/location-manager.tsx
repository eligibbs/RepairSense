"use client";

import { MapPin, Plus, X } from "lucide-react";
import { useRef } from "react";

type Location = { id: string; code: string; name: string; deviceCount: number };

export function LocationManager({
  locations,
  addAction,
  updateAction,
}: {
  locations: Location[];
  addAction: (formData: FormData) => Promise<void>;
  updateAction: (locationId: string, formData: FormData) => Promise<void>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  return <section className="panel overflow-hidden">
    <header className="flex items-center justify-between gap-3 border-b border-border bg-zinc-50 px-panel py-2.5"><div><h2 className="text-sm font-semibold">Locations</h2><p className="text-2xs text-muted">Edit customer sites directly or add another location.</p></div><button className="button-ghost border-border" onClick={() => dialogRef.current?.showModal()} type="button"><Plus className="size-3.5" />Add</button></header>
    <div className="divide-y divide-border">
      {locations.map((location) => <form action={updateAction.bind(null, location.id)} className="grid gap-2 px-panel py-3 sm:grid-cols-[28px_110px_minmax(180px,1fr)_90px_58px] sm:items-end" key={location.id}>
        <MapPin className="mb-2 size-4 text-muted" />
        <label className="grid gap-1 text-2xs font-medium text-muted">Code<input className="control uppercase" defaultValue={location.code} maxLength={12} name="code" required /></label>
        <label className="grid gap-1 text-2xs font-medium text-muted">Location name<input className="control" defaultValue={location.name} name="name" required /></label>
        <span className="mb-2 text-right text-2xs text-muted">{location.deviceCount} device{location.deviceCount === 1 ? "" : "s"}</span>
        <button className="button-ghost border-border" type="submit">Save</button>
      </form>)}
      {!locations.length && <p className="p-6 text-center text-xs text-muted">No locations yet. Use Add to create the first one.</p>}
    </div>

    <dialog className="m-auto w-[calc(100%-2rem)] max-w-md rounded-lg border border-border bg-white p-0 text-foreground shadow-xl backdrop:bg-black/40" ref={dialogRef}>
      <form action={async (formData) => { await addAction(formData); dialogRef.current?.close(); }}>
        <header className="flex items-center justify-between border-b border-border bg-zinc-50 px-panel py-2.5"><div><h2 className="text-sm font-semibold">Add location</h2><p className="text-2xs text-muted">Create another site for this customer.</p></div><button aria-label="Close add location" className="grid size-7 place-items-center rounded-md text-muted hover:bg-zinc-100" onClick={() => dialogRef.current?.close()} type="button"><X className="size-4" /></button></header>
        <div className="grid gap-3 p-4"><label className="grid gap-1 text-xs font-medium">Code<input autoFocus className="control uppercase" maxLength={12} name="code" placeholder="KCT" required /></label><label className="grid gap-1 text-xs font-medium">Location name<input className="control" name="name" placeholder="Kids Count Therapy" required /></label></div>
        <footer className="flex justify-end gap-2 border-t border-border px-4 py-3"><button className="button-ghost border-border" onClick={() => dialogRef.current?.close()} type="button">Cancel</button><button className="button-primary" type="submit"><Plus className="size-3.5" />Add location</button></footer>
      </form>
    </dialog>
  </section>;
}
