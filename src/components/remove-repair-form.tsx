"use client";

import { ArchiveX } from "lucide-react";

export function RemoveRepairForm({ action, deviceName, pickupNumber }: { action: (formData: FormData) => void | Promise<void>; deviceName: string; pickupNumber: string }) {
  return (
    <form action={action} className="panel p-panel" onSubmit={(event) => {
      if (!window.confirm(`Remove ${deviceName} from ${pickupNumber}? Its repair record and notes will be permanently deleted, and the device will no longer be in your possession.`)) event.preventDefault();
    }}>
      <button className="button-ghost w-full border-red-200 text-red-700 hover:bg-red-50" type="submit"><ArchiveX className="size-3.5" />Remove from pickup</button>
      <p className="mt-2 text-2xs leading-4 text-muted">Permanently deletes this repair record without affecting the other devices in the pickup.</p>
    </form>
  );
}
