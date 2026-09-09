"use client";

import { ArchiveX, Laptop } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { batchRemoveDevices } from "@/app/actions";

interface DeviceRow {
  id: string;
  name: string;
  customerName: string;
  locationCode: string | null;
  serialNumber: string;
  assetTag: string | null;
  disposition: "ACTIVE" | "RECYCLED" | "REMOVED";
  activeRepair: { id: string; intakeNumber: string } | null;
}

export function DeviceTable({ devices, allowBatchRemove }: { devices: DeviceRow[]; allowBatchRemove: boolean }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const allSelected = Boolean(devices.length) && devices.every((device) => selected.has(device.id));

  return <form action={async (formData) => { await batchRemoveDevices(formData); setSelected(new Set()); }} onSubmit={(event) => { if (!window.confirm(`Remove ${selected.size} selected device${selected.size === 1 ? "" : "s"} from active customer devices?`)) event.preventDefault(); }}>
    <div className="flex h-9 items-center justify-between gap-3 border-b border-border px-panel text-xs text-muted"><span>{devices.length} device{devices.length === 1 ? "" : "s"}</span>{allowBatchRemove && <button className="button-ghost border-border text-red-700" disabled={!selected.size} type="submit"><ArchiveX className="size-3.5" />Remove selected ({selected.size})</button>}</div>
    <div className="overflow-x-auto"><table className="w-full min-w-[820px] text-left text-xs"><thead className="border-b border-border bg-zinc-50 text-2xs uppercase tracking-wide text-muted"><tr>{allowBatchRemove && <th className="w-10 px-panel py-2"><input aria-label="Select all visible devices" checked={allSelected} onChange={(event) => setSelected(event.target.checked ? new Set(devices.map((device) => device.id)) : new Set())} type="checkbox" /></th>}<th className="px-panel py-2">Device</th><th className="px-panel py-2">Customer / location</th><th className="px-panel py-2">Serial</th><th className="px-panel py-2">Asset tag</th><th className="px-panel py-2">State</th></tr></thead><tbody className="divide-y divide-border">{devices.map((device) => <tr className="hover:bg-blue-50/50" key={device.id}>{allowBatchRemove && <td className="px-panel py-2.5"><input aria-label={`Select ${device.name}`} checked={selected.has(device.id)} name="assetId" onChange={(event) => setSelected((current) => { const next = new Set(current); if (event.target.checked) next.add(device.id); else next.delete(device.id); return next; })} type="checkbox" value={device.id} /></td>}<td className="px-panel py-2.5"><Link className="flex items-center gap-2 font-semibold text-primary hover:underline" href={`/devices/${device.id}`}><Laptop className="size-3.5" />{device.name}</Link></td><td className="px-panel py-2.5"><span className="font-medium">{device.customerName}</span><span className="block text-2xs text-muted">{device.locationCode ?? "No location"}</span></td><td className="px-panel py-2.5 font-mono text-2xs">{device.serialNumber}</td><td className="px-panel py-2.5 text-muted">{device.assetTag ?? "—"}</td><td className="px-panel py-2.5">{device.disposition !== "ACTIVE" ? <span className="inline-flex rounded-full border border-zinc-200 bg-zinc-100 px-2 py-0.5 text-2xs font-semibold capitalize text-zinc-700">{device.disposition.toLowerCase()}</span> : device.activeRepair ? <Link className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-2xs font-semibold text-amber-700" href={`/work-orders/${device.activeRepair.id}`}>In possession · {device.activeRepair.intakeNumber}</Link> : <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-2xs font-semibold text-emerald-700">Okay · not in possession</span>}</td></tr>)}</tbody></table></div>
    {!devices.length && <p className="p-8 text-center text-xs text-muted">No devices match these filters.</p>}
  </form>;
}
