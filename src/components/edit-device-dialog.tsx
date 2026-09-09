"use client";

import { Pencil, X } from "lucide-react";
import { useActionState, useEffect, useRef } from "react";
import { updateDeviceDetails, type UpdateDeviceState } from "@/app/actions";

type DeviceDetails = {
  id: string;
  brand: string;
  rawModel: string | null;
  family: string | null;
  modelYear: number | null;
  chipset: string | null;
  serialNumber: string;
  assetTag: string | null;
  locationId: string | null;
};

type LocationOption = { id: string; code: string; name: string };

export function EditDeviceDialog({ device, locations }: { device: DeviceDetails; locations: LocationOption[] }) {
  const [state, action, pending] = useActionState<UpdateDeviceState, FormData>(updateDeviceDetails.bind(null, device.id), {});
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (state.saved) dialogRef.current?.close();
  }, [state]);

  return <>
    <button className="button-ghost border-border" onClick={() => dialogRef.current?.showModal()} type="button"><Pencil className="size-3.5" />Edit device</button>
    <dialog className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-lg border border-border bg-white p-0 text-foreground shadow-xl backdrop:bg-black/40" ref={dialogRef}>
      <form action={action}>
        <header className="flex items-center justify-between border-b border-border bg-zinc-50 px-panel py-2.5"><div><h2 className="text-sm font-semibold">Edit device</h2><p className="text-2xs text-muted">Update identifying details and customer location.</p></div><button aria-label="Close edit device" className="grid size-7 place-items-center rounded-md text-muted hover:bg-zinc-100" onClick={() => dialogRef.current?.close()} type="button"><X className="size-4" /></button></header>
        <div className="grid gap-3 p-4 sm:grid-cols-2">
          <label className="grid gap-1 text-xs font-medium">Brand<input autoFocus className="control" defaultValue={device.brand} maxLength={100} name="brand" required /></label>
          <label className="grid gap-1 text-xs font-medium">Model / family<input className="control" defaultValue={device.rawModel ?? device.family ?? ""} maxLength={300} name="family" required /></label>
          <label className="grid gap-1 text-xs font-medium">Serial number<input className="control" defaultValue={device.serialNumber} maxLength={200} name="serialNumber" required /></label>
          <label className="grid gap-1 text-xs font-medium">Asset tag<input className="control" defaultValue={device.assetTag ?? ""} maxLength={200} name="assetTag" placeholder="Optional" /></label>
          <label className="grid gap-1 text-xs font-medium">Model year<input className="control" defaultValue={device.modelYear ?? ""} inputMode="numeric" max={new Date().getFullYear() + 1} min="1970" name="modelYear" placeholder="Optional" type="number" /></label>
          <label className="grid gap-1 text-xs font-medium">Chipset / processor<input className="control" defaultValue={device.chipset ?? ""} maxLength={200} name="chipset" placeholder="Optional" /></label>
          <label className="grid gap-1 text-xs font-medium sm:col-span-2">Location<select className="control" defaultValue={device.locationId ?? ""} name="locationId"><option value="">Not assigned</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.code} — {location.name}</option>)}</select></label>
          {state.error && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 sm:col-span-2" role="alert">{state.error}</p>}
        </div>
        <footer className="flex justify-end gap-2 border-t border-border px-4 py-3"><button className="button-ghost border-border" onClick={() => dialogRef.current?.close()} type="button">Cancel</button><button className="button-primary" disabled={pending} type="submit">{pending ? "Saving…" : "Save changes"}</button></footer>
      </form>
    </dialog>
  </>;
}
