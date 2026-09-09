"use client";

import { Plus } from "lucide-react";
import { useActionState, useEffect, useRef } from "react";
import type { AddSaleDeviceState } from "@/app/actions";

type LocationOption = { id: string; code: string; name: string };

export function AddSaleDeviceForm({
  action,
  locations,
}: {
  action: (state: AddSaleDeviceState, formData: FormData) => Promise<AddSaleDeviceState>;
  locations: LocationOption[];
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success]);

  return <form action={formAction} className="grid gap-3 p-panel sm:grid-cols-2" ref={formRef}>
    <label className="grid gap-1 text-xs font-medium">Brand<input className="control" name="brand" placeholder="Apple" required /></label>
    <label className="grid gap-1 text-xs font-medium">Model / family<input className="control" name="family" placeholder="iPad 10th Gen" required /></label>
    <label className="grid gap-1 text-xs font-medium">Serial number<input className="control" name="serialNumber" required /></label>
    <label className="grid gap-1 text-xs font-medium">Asset tag<input className="control" name="assetTag" placeholder="Optional" /></label>
    <label className="grid gap-1 text-xs font-medium">Location<select className="control" name="locationId"><option value="">Not assigned</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.code} — {location.name}</option>)}</select></label>
    <div className="flex items-end"><button className="button-primary" disabled={pending} type="submit"><Plus className="size-3.5" />{pending ? "Adding…" : "Add new device"}</button></div>
    {state.error && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 sm:col-span-2" role="alert">{state.error}</p>}
    {state.success && <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 sm:col-span-2" role="status">{state.success}</p>}
  </form>;
}
