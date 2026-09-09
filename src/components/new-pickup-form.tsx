"use client";

import { Check, Search, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { createPickup } from "@/app/actions";
import { DeviceDialog } from "@/components/device-dialog";

interface CustomerOption {
  id: string;
  name: string;
  locations: { id: string; code: string; name: string }[];
}

interface AssetResult {
  id: string;
  name: string;
  serialNumber: string;
  assetTag: string | null;
  location: string | null;
}

export function NewPickupForm({ customers, defaultDate }: { customers: CustomerOption[]; defaultDate: string }) {
  const [customerId, setCustomerId] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AssetResult[]>([]);
  const [selected, setSelected] = useState<AssetResult[]>([]);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = (value: string, selectedCustomerId = customerId) => {
    setQuery(value);
    if (timer.current) clearTimeout(timer.current);
    if (!value.trim() || !selectedCustomerId) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    timer.current = setTimeout(async () => {
      const response = await fetch(`/api/assets/search?q=${encodeURIComponent(value.trim())}&customerId=${encodeURIComponent(selectedCustomerId)}`);
      const assets = response.ok ? await response.json() as AssetResult[] : [];
      setResults(assets.filter((asset) => !selected.some((item) => item.id === asset.id)));
      setLoading(false);
    }, 250);
  };

  const chooseAsset = (asset: AssetResult) => {
    setSelected((items) => [...items, asset]);
    setResults((items) => items.filter((item) => item.id !== asset.id));
  };

  const addCreatedDevice = useCallback((asset: AssetResult) => {
    setSelected((items) => items.some((item) => item.id === asset.id) ? items : [...items, asset]);
    setResults((items) => items.filter((item) => item.id !== asset.id));
  }, []);

  return (
    <form action={createPickup} className="panel max-w-3xl">
      <div className="grid gap-4 p-4 sm:grid-cols-2">
        <label className="grid gap-1 text-xs font-medium">Customer
          <select className="control" name="customerId" onChange={(event) => { setCustomerId(event.target.value); setSelected([]); search("", event.target.value); }} required value={customerId}>
            <option value="">Select a customer…</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-medium">Pickup date<input className="control" defaultValue={defaultDate} name="pickedUpAt" required type="date" /></label>
        <div className="sm:col-span-2">
          <div className="mb-1 flex items-end justify-between gap-3"><span className="text-xs font-medium">Find devices</span><DeviceDialog buttonLabel="Add new device" customers={customers} lockedCustomerId={customerId} onCreated={addCreatedDevice} /></div>
          <label className="relative block"><span className="sr-only">Find devices</span><Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted" /><input autoComplete="off" className="control w-full pl-8" disabled={!customerId} onChange={(event) => search(event.target.value)} placeholder={customerId ? "Serial, asset tag, or model" : "Select a customer first"} value={query} /></label>
          <div className="mt-1 min-h-5 text-2xs text-muted">{loading ? "Searching…" : results.length ? `${results.length} available device${results.length === 1 ? "" : "s"} found` : query.trim() ? "No available devices found" : "Start typing to search available devices"}</div>
          {results.length > 0 && <div className="mt-1 max-h-52 overflow-y-auto rounded-md border border-border bg-white divide-y divide-border">{results.map((asset) => <button className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-blue-50/50" key={asset.id} onClick={() => chooseAsset(asset)} type="button"><span><strong className="block text-xs">{asset.name}</strong><span className="text-2xs text-muted">{asset.location ?? "No location"} · {asset.serialNumber}{asset.assetTag ? ` · ${asset.assetTag}` : ""}</span></span><Check className="size-4 text-primary" /></button>)}</div>}
        </div>
      </div>

      <div className="border-t border-border">
        <div className="flex items-center justify-between bg-zinc-50 px-4 py-2"><div><h2 className="text-xs font-semibold">Devices in this pickup</h2><p className="text-2xs text-muted">Add a reported issue now or document it later.</p></div><span className="text-xs font-semibold tabular-nums">{selected.length}</span></div>
        <div className="divide-y divide-border">
          {selected.map((asset) => <div className="grid gap-2 px-4 py-3 sm:grid-cols-[1fr_1fr_30px] sm:items-center" key={asset.id}><input name="assetId" type="hidden" value={asset.id} /><div><strong className="block text-xs">{asset.name}</strong><span className="text-2xs text-muted">{asset.location ?? "No location"} · {asset.serialNumber}</span></div><input className="control" name={`issue:${asset.id}`} placeholder="Reported issue (optional)" /><button aria-label={`Remove ${asset.name}`} className="grid size-7 place-items-center rounded-md border border-border text-muted hover:bg-red-50 hover:text-red-700" onClick={() => setSelected((items) => items.filter((item) => item.id !== asset.id))} type="button"><X className="size-3.5" /></button></div>)}
          {!selected.length && <p className="px-4 py-6 text-center text-xs text-muted">No devices selected yet.</p>}
        </div>
      </div>
      <div className="flex justify-end gap-2 border-t border-border px-4 py-3"><Link className="button-ghost border-border" href="/">Cancel</Link><button className="button-primary" disabled={!selected.length} type="submit">Create pickup ({selected.length})</button></div>
    </form>
  );
}
