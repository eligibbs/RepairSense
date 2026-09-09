"use client";

import { ArchiveX } from "lucide-react";

export function RemovePickupForm({ action, deviceCount, pickupNumber }: { action: () => Promise<void>; deviceCount: number; pickupNumber: string }) {
  return <form action={action} onSubmit={(event) => { if (!window.confirm(`Remove ${pickupNumber}? ${deviceCount} device${deviceCount === 1 ? "" : "s"} will return to not in your possession.`)) event.preventDefault(); }}><button className="button-ghost border-red-200 text-red-700 hover:bg-red-50" type="submit"><ArchiveX className="size-3.5" />Remove pickup</button></form>;
}
