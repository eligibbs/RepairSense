"use client";

import { Plus, X } from "lucide-react";
import { useActionState, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { createManagedDevice, type CreateDeviceState } from "@/app/actions";

export interface DeviceCustomerOption {
  id: string;
  name: string;
  locations: { id: string; code: string; name: string }[];
}

const subscribeToBrowser = () => () => {};

export function DeviceDialog({
  customers,
  lockedCustomerId,
  onCreated,
  buttonLabel = "Add device",
}: {
  customers: DeviceCustomerOption[];
  lockedCustomerId?: string;
  onCreated?: (device: NonNullable<CreateDeviceState["device"]>) => void;
  buttonLabel?: string;
}) {
  const [state, action, pending] = useActionState(createManagedDevice, {});
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const mounted = useSyncExternalStore(subscribeToBrowser, () => true, () => false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const customerId = lockedCustomerId ?? selectedCustomerId;
  const locations = customers.find((customer) => customer.id === customerId)?.locations ?? [];

  useEffect(() => {
    if (!state.device) return;
    onCreated?.(state.device);
    formRef.current?.reset();
    dialogRef.current?.close();
  }, [state.device, onCreated]);

  return <>
    <button className="button-primary" disabled={Boolean(lockedCustomerId === "")} onClick={() => dialogRef.current?.showModal()} type="button"><Plus className="size-3.5" />{buttonLabel}</button>
    {mounted && createPortal(<dialog className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-lg border border-border bg-white p-0 text-foreground shadow-xl backdrop:bg-black/40" ref={dialogRef}>
      <form action={action} ref={formRef}>
        <header className="flex items-center justify-between border-b border-border bg-zinc-50 px-panel py-2.5"><div><h2 className="text-sm font-semibold">Add device</h2><p className="text-2xs text-muted">Create a device that is not yet in NinjaOne.</p></div><button aria-label="Close add device" className="grid size-7 place-items-center rounded-md text-muted hover:bg-zinc-100" onClick={() => dialogRef.current?.close()} type="button"><X className="size-4" /></button></header>
        <div className="grid gap-3 p-4 sm:grid-cols-2">
          {lockedCustomerId !== undefined ? <input name="customerId" type="hidden" value={lockedCustomerId} /> : <label className="grid gap-1 text-xs font-medium sm:col-span-2">Customer<select className="control" name="customerId" onChange={(event) => setSelectedCustomerId(event.target.value)} required value={selectedCustomerId}><option value="">Select customer</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></label>}
          <label className="grid gap-1 text-xs font-medium">Brand<input className="control" name="brand" placeholder="Apple" required /></label>
          <label className="grid gap-1 text-xs font-medium">Model / family<input className="control" name="family" placeholder="MacBook Air, Apple M1, 2020" required /></label>
          <label className="grid gap-1 text-xs font-medium">Serial number<input className="control" name="serialNumber" required /></label>
          <label className="grid gap-1 text-xs font-medium">Asset tag<input className="control" name="assetTag" placeholder="Optional" /></label>
          <label className="grid gap-1 text-xs font-medium sm:col-span-2">Location<select className="control" disabled={!customerId} name="locationId"><option value="">Not assigned</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.code} — {location.name}</option>)}</select></label>
          {state.error && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 sm:col-span-2" role="alert">{state.error}</p>}
        </div>
        <footer className="flex justify-end gap-2 border-t border-border px-4 py-3"><button className="button-ghost border-border" onClick={() => dialogRef.current?.close()} type="button">Cancel</button><button className="button-primary" disabled={pending} type="submit">{pending ? "Adding…" : "Add device"}</button></footer>
      </form>
    </dialog>, document.body)}
  </>;
}
