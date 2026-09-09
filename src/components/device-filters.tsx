"use client";

import { Search, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

export function DeviceFilters({ initialLocation, initialQuery, initialState, locations }: { initialLocation: string; initialQuery: string; initialState: string; locations: { id: string; code: string; name: string }[] }) {
  const [query, setQuery] = useState(initialQuery);
  const [state, setState] = useState(initialState);
  const [location, setLocation] = useState(initialLocation);
  const [pending, startTransition] = useTransition();
  const firstRender = useRef(true);
  const pathname = usePathname();
  const router = useRouter();

  const navigate = (nextQuery: string, nextState: string, nextLocation: string) => {
    const params = new URLSearchParams();
    if (nextQuery.trim()) params.set("q", nextQuery.trim());
    if (nextState !== "all") params.set("state", nextState);
    if (nextLocation) params.set("location", nextLocation);
    startTransition(() => router.replace(`${pathname}${params.size ? `?${params}` : ""}`, { scroll: false }));
  };

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const timer = setTimeout(() => navigate(query, state, location), 250);
    return () => clearTimeout(timer);
    // Navigation should only debounce text input; selects navigate in their handlers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  return <div className="flex flex-wrap gap-2 border-b border-border p-panel">
    <label className="relative min-w-56 flex-1"><Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted" /><span className="sr-only">Search devices</span><input className="control w-full pl-8" onChange={(event) => setQuery(event.target.value)} placeholder="Serial, asset tag, model, or customer…" value={query} /></label>
    <select className="control" onChange={(event) => { const value = event.target.value; setState(value); navigate(query, value, location); }} value={state}><option value="all">All active devices</option><option value="available">Okay · not in possession</option><option value="held">In possession</option><option value="archived">Recycled / removed</option></select>
    <select className="control max-w-52" onChange={(event) => { const value = event.target.value; setLocation(value); navigate(query, state, value); }} value={location}><option value="">All locations</option>{locations.map((item) => <option key={item.id} value={item.id}>{item.code} — {item.name}</option>)}</select>
    {(query || state !== "all" || location) && <button className="button-ghost border-border" onClick={() => { setQuery(""); setState("all"); setLocation(""); navigate("", "all", ""); }} type="button"><X className="size-3.5" />Clear</button>}
    {pending && <span className="self-center text-2xs text-muted">Updating…</span>}
  </div>;
}
