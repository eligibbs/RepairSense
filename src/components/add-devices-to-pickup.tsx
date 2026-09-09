"use client";

import { Check, Plus, Search, X } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

interface AssetResult {
  id: string;
  name: string;
  serialNumber: string;
  assetTag: string | null;
  location: string | null;
}

const subscribeToBrowser = () => () => {};

export function AddDevicesToPickup({ action, customerId, customerName, pickupNumber }: {
  action: (formData: FormData) => void | Promise<void>;
  customerId: string;
  customerName: string;
  pickupNumber: string;
}) {
  const mounted = useSyncExternalStore(subscribeToBrowser, () => true, () => false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AssetResult[]>([]);
  const [selected, setSelected] = useState<AssetResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const search = (value: string) => {
    setQuery(value);
    if (timer.current) clearTimeout(timer.current);
    if (!value.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    timer.current = setTimeout(async () => {
      const response = await fetch(`/api/assets/search?q=${encodeURIComponent(value.trim())}&customerId=${encodeURIComponent(customerId)}`);
      const assets = response.ok ? await response.json() as AssetResult[] : [];
      setResults(assets.filter((asset) => !selected.some((item) => item.id === asset.id)));
      setLoading(false);
    }, 250);
  };

  const close = () => {
    if (timer.current) clearTimeout(timer.current);
    setQuery("");
    setResults([]);
    setSelected([]);
    setLoading(false);
    dialogRef.current?.close();
  };

  return <>
    <button className="button-ghost border-border" onClick={() => dialogRef.current?.showModal()} type="button"><Plus className="size-3.5" />Add device</button>
    {mounted && createPortal(<dialog className="m-auto w-[calc(100%-2rem)] max-w-2xl rounded-lg border border-border bg-white p-0 text-foreground shadow-xl backdrop:bg-black/40" ref={dialogRef}>
      <form action={action}>
        <header className="flex items-center justify-between border-b border-border bg-zinc-50 px-panel py-2.5"><div><h2 className="text-sm font-semibold">Add devices to {pickupNumber}</h2><p className="text-2xs text-muted">Available devices for {customerName}</p></div><button aria-label="Close add devices" className="grid size-7 place-items-center rounded-md text-muted hover:bg-zinc-100" onClick={close} type="button"><X className="size-4" /></button></header>
        <div className="p-4">
          <label className="relative block"><span className="sr-only">Find devices</span><Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted" /><input autoComplete="off" autoFocus className="control w-full pl-8" onChange={(event) => search(event.target.value)} placeholder="Serial, asset tag, or model" value={query} /></label>
          <div className="mt-1 min-h-5 text-2xs text-muted">{loading ? "Searching…" : results.length ? `${results.length} available device${results.length === 1 ? "" : "s"} found` : query.trim() ? "No available devices found" : "Start typing to search available devices"}</div>
          {results.length > 0 && <div className="mt-1 max-h-48 overflow-y-auto rounded-md border border-border bg-white divide-y divide-border">{results.map((asset) => <button className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-blue-50/50" key={asset.id} onClick={() => { setSelected((items) => [...items, asset]); setResults((items) => items.filter((item) => item.id !== asset.id)); }} type="button"><span><strong className="block text-xs">{asset.name}</strong><span className="text-2xs text-muted">{asset.location ?? "No location"} · {asset.serialNumber}{asset.assetTag ? ` · ${asset.assetTag}` : ""}</span></span><Check className="size-4 text-primary" /></button>)}</div>}
        </div>
        <div className="border-t border-border"><div className="flex items-center justify-between bg-zinc-50 px-4 py-2"><div><h3 className="text-xs font-semibold">Devices to add</h3><p className="text-2xs text-muted">They inherit this pickup&apos;s date and number.</p></div><span className="text-xs font-semibold tabular-nums">{selected.length}</span></div><div className="max-h-60 overflow-y-auto divide-y divide-border">{selected.map((asset) => <div className="grid gap-2 px-4 py-3 sm:grid-cols-[1fr_1fr_30px] sm:items-center" key={asset.id}><input name="assetId" type="hidden" value={asset.id} /><div><strong className="block text-xs">{asset.name}</strong><span className="text-2xs text-muted">{asset.location ?? "No location"} · {asset.serialNumber}</span></div><input className="control" name={`issue:${asset.id}`} placeholder="Reported issue (optional)" /><button aria-label={`Remove ${asset.name}`} className="grid size-7 place-items-center rounded-md border border-border text-muted hover:bg-red-50 hover:text-red-700" onClick={() => setSelected((items) => items.filter((item) => item.id !== asset.id))} type="button"><X className="size-3.5" /></button></div>)}{!selected.length && <p className="px-4 py-5 text-center text-xs text-muted">No devices selected yet.</p>}</div></div>
        <footer className="flex justify-end gap-2 border-t border-border px-4 py-3"><button className="button-ghost border-border" onClick={close} type="button">Cancel</button><button className="button-primary" disabled={!selected.length} type="submit">Add {selected.length || ""} device{selected.length === 1 ? "" : "s"}</button></footer>
      </form>
    </dialog>, document.body)}
  </>;
}
