import type { RepairStatus } from "@/generated/prisma/enums";
import Link from "next/link";

export interface WorkOrderListItem {
  id: string;
  intakeNumber: string;
  pickedUpAt: Date;
  dueAt: Date | null;
  status: RepairStatus;
  technician: string | null;
  asset: {
    brand: string;
    family: string | null;
    rawModel: string | null;
    customer: { name: string };
  };
}

const statusLabels: Record<RepairStatus, string> = {
  IN_POSSESSION: "Open",
  IN_TRIAGE: "Diagnosing",
  WAITING_PARTS: "Waiting parts",
  IN_REPAIR: "In repair",
  READY_FOR_DELIVERY: "Ready",
  DELIVERED: "Delivered",
  REMOVED: "Removed",
  CANCELLED: "Pickup removed",
};

const statusStyles: Record<RepairStatus, string> = {
  IN_POSSESSION: "border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-500 dark:bg-zinc-700 dark:text-foreground",
  IN_TRIAGE: "border-blue-200 bg-blue-50 text-blue-700",
  WAITING_PARTS: "border-amber-200 bg-amber-50 text-amber-700",
  IN_REPAIR: "border-indigo-200 bg-indigo-50 text-indigo-700",
  READY_FOR_DELIVERY: "border-emerald-200 bg-emerald-50 text-emerald-700",
  DELIVERED: "border-zinc-200 bg-zinc-100 text-zinc-600",
  REMOVED: "border-red-200 bg-red-50 text-red-700",
  CANCELLED: "border-zinc-200 bg-zinc-100 text-zinc-600",
};

export function statusLabel(status: RepairStatus) {
  return statusLabels[status];
}

export function StatusBadge({ status }: { status: RepairStatus }) {
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-2xs font-semibold ${statusStyles[status]}`}>{statusLabels[status]}</span>;
}

export function WorkOrderTable({ orders }: { orders: WorkOrderListItem[] }) {
  if (!orders.length) return <p className="px-panel py-8 text-center text-xs text-muted">No work orders found.</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-left text-xs">
        <thead className="border-b border-border bg-zinc-50 text-2xs uppercase tracking-wide text-muted"><tr><th className="px-panel py-2">Order</th><th className="px-panel py-2">Customer</th><th className="px-panel py-2">Asset</th><th className="px-panel py-2">Status</th><th className="px-panel py-2">Technician</th><th className="px-panel py-2 text-right">Due</th></tr></thead>
        <tbody className="divide-y divide-border">
          {orders.map((order) => {
            const assetName = order.asset.rawModel ?? [order.asset.brand, order.asset.family].filter(Boolean).join(" ");
            return (
              <tr className="bg-white hover:bg-blue-50/50" key={order.id}>
                <td className="px-panel py-2.5 font-semibold"><Link className="text-primary underline-offset-2 hover:underline" href={`/work-orders/${order.id}`}>{order.intakeNumber}</Link></td>
                <td className="px-panel py-2.5 font-medium">{order.asset.customer.name}</td>
                <td className="px-panel py-2.5 text-muted">{assetName}</td>
                <td className="px-panel py-2.5"><StatusBadge status={order.status} /></td>
                <td className="px-panel py-2.5 text-muted">{order.technician ?? "Unassigned"}</td>
                <td className="px-panel py-2.5 text-right font-medium tabular-nums">{order.dueAt ? order.dueAt.toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
