"use client";

import { Trash2 } from "lucide-react";

export function RemoveRepairButton({ action, deviceName, pickupNumber }: {
  action: (formData: FormData) => void | Promise<void>;
  deviceName: string;
  pickupNumber: string;
}) {
  return <form action={action} onSubmit={(event) => {
    if (!window.confirm(`Remove ${deviceName} from ${pickupNumber}? Its repair record and notes will be permanently deleted, and the device will no longer be in your possession.`)) event.preventDefault();
  }}><button aria-label={`Remove ${deviceName} from pickup`} className="grid size-7 place-items-center rounded-md border border-border text-muted hover:border-red-200 hover:bg-red-50 hover:text-red-700" title="Remove from pickup" type="submit"><Trash2 className="size-3.5" /></button></form>;
}
