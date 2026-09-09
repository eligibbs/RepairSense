"use client";

import { Trash2 } from "lucide-react";

export function DeleteDeliveryForm({ action, deliveryNumber }: { action: () => Promise<void>; deliveryNumber: string }) {
  return <form action={action} onSubmit={(event) => {
    if (!window.confirm(`Delete draft ${deliveryNumber}? Repair devices will return to their open pickups.`)) event.preventDefault();
  }}>
    <button className="button-ghost w-full border-red-200 text-red-700 hover:bg-red-50" type="submit"><Trash2 className="size-3.5" />Delete draft</button>
  </form>;
}
