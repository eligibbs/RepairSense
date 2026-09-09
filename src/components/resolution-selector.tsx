"use client";

import { Check, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const resolutionOptions = {
  REPLACE_DEVICE: [],
  REPLACE_PART: [
    ["SCREEN", "Screen"], ["BATTERY", "Battery"], ["IO_BOARD", "I/O board"], ["MAIN_BOARD", "Main board"],
    ["CHARGER_PORT", "Charger port"], ["SPEAKER", "Speaker"], ["RAM", "RAM"], ["DRIVE", "Drive"],
    ["FRAME", "Frame"], ["KEYBOARD", "Keyboard"], ["TRACKPAD", "Trackpad"], ["TOUCH_DIGITIZER", "Touch digitizer"],
    ["CAMERA", "Camera"], ["MICROPHONE", "Microphone"], ["FAN", "Fan"], ["HEATSINK", "Heatsink"],
    ["HINGE", "Hinge"], ["DISPLAY_CABLE", "Display cable"], ["WIFI_CARD", "Wi-Fi card"], ["OTHER", "Other"],
  ],
  RESET: [["FACTORY_RESET", "Factory reset"], ["SMC", "SMC reset"], ["PRAM", "PRAM reset"], ["SOFT_RESET", "Soft reset"]],
  MISC: [["ENROLL", "Enroll"], ["INSTALL", "Install"]],
} as const;

type ResolutionTypeValue = keyof typeof resolutionOptions;
type ResolutionOption = (typeof resolutionOptions)[ResolutionTypeValue][number];
interface SelectedAction { type: ResolutionTypeValue; item: string | null }

const resolutionTypeLabels: Record<ResolutionTypeValue, string> = {
  REPLACE_DEVICE: "Replace device",
  REPLACE_PART: "Replace part",
  RESET: "Reset",
  MISC: "Misc",
};

function actionKey(action: SelectedAction) {
  return `${action.type}:${action.item ?? ""}`;
}

function actionLabel(action: SelectedAction) {
  if (!action.item) return resolutionTypeLabels[action.type];
  const option = resolutionOptions[action.type].find(([value]) => value === action.item);
  return `${resolutionTypeLabels[action.type]} · ${option?.[1] ?? action.item}`;
}

export function ResolutionSelector({ initialActions }: { initialActions: SelectedAction[] }) {
  const [type, setType] = useState<ResolutionTypeValue | "">("");
  const [selected, setSelected] = useState<SelectedAction[]>(initialActions);
  const [query, setQuery] = useState("");
  const [listOpen, setListOpen] = useState(false);
  const searchArea = useRef<HTMLDivElement>(null);
  const options: readonly ResolutionOption[] = type ? resolutionOptions[type] : [];
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = options.filter(([value, label]) =>
    !selected.some((action) => action.type === type && action.item === value)
    && (!normalizedQuery || label.toLowerCase().includes(normalizedQuery))
  );

  useEffect(() => {
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!searchArea.current?.contains(event.target as Node)) setListOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, []);

  const changeType = (nextType: ResolutionTypeValue | "") => {
    setType(nextType);
    setQuery("");
    setListOpen(false);
    if (nextType === "REPLACE_DEVICE") setSelected([{ type: "REPLACE_DEVICE", item: null }]);
  };

  return (
    <fieldset className="grid gap-2 sm:col-span-2">
      <legend className="mb-1 text-xs font-medium">Resolution</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid content-start gap-1 text-xs font-medium">Action type
          <select className="control" onChange={(event) => changeType(event.target.value as ResolutionTypeValue | "")} value={type}>
            <option value="">Select an action…</option>
            {Object.entries(resolutionTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <div className="grid content-start gap-1">
          <span className="text-xs font-medium">Details</span>
          {!type && <div className="control flex items-center bg-zinc-50 text-muted">Select an action type first</div>}
          {type === "REPLACE_DEVICE" && <div className="control flex items-center bg-zinc-50 text-muted">Selected exclusively; other actions were cleared</div>}
          {type && options.length > 0 && <div className="relative" ref={searchArea}>
            <label className="relative block"><span className="sr-only">Search action details</span><Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted" /><input autoComplete="off" className="control w-full pl-8" onChange={(event) => setQuery(event.target.value)} onFocus={() => setListOpen(true)} onKeyDown={(event) => { if (event.key === "Escape") { setListOpen(false); event.currentTarget.blur(); } }} placeholder="Search options" value={query} /></label>
            {listOpen && <div className="absolute z-20 mt-1 max-h-44 w-full overflow-y-auto rounded-md border border-border bg-white divide-y divide-border">
              {filtered.map(([value, label]) => <button className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-xs hover:bg-blue-50/50" key={value} onClick={() => { setSelected((actions) => [...actions.filter((action) => action.type !== "REPLACE_DEVICE"), { type: type as ResolutionTypeValue, item: value }]); setQuery(""); }} type="button"><span>{label}</span><Check className="size-4 text-primary" /></button>)}
              {!filtered.length && <p className="px-3 py-2 text-2xs text-muted">No matching options.</p>}
            </div>}
          </div>}
        </div>
      </div>
      {selected.length > 0 ? <div className="flex flex-wrap gap-1.5">{selected.map((action) => {
        const key = actionKey(action);
        return <span className="inline-flex items-center gap-1 rounded-md border border-border bg-zinc-50 px-2 py-1 text-2xs font-medium" key={key}><input name="resolutionAction" type="hidden" value={key} />{actionLabel(action)}<button aria-label={`Remove ${actionLabel(action)}`} className="text-muted hover:text-red-700" onClick={() => setSelected((actions) => actions.filter((item) => actionKey(item) !== key))} type="button"><X className="size-3" /></button></span>;
      })}</div> : <p className="text-2xs text-muted">No resolution actions added yet.</p>}
    </fieldset>
  );
}
