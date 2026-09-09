import Link from "next/link";
import { notFound } from "next/navigation";
import { disposeRepairDevice, permanentlyDeleteRepairRecord, removeRepairFromPickup, updateRepairIntake } from "@/app/actions";
import { DeleteRepairRecordForm } from "@/components/delete-repair-record-form";
import { DisposeDeviceForm } from "@/components/dispose-device-form";
import { PageHeader } from "@/components/page-header";
import { ResolutionSelector } from "@/components/resolution-selector";
import { RemoveRepairForm } from "@/components/remove-repair-form";
import { statusLabel, StatusBadge } from "@/components/work-order-table";
import { AssetDisposition, RepairStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function currentTime() {
  return Date.now();
}

const editableStatuses = [
  RepairStatus.IN_POSSESSION,
  RepairStatus.IN_TRIAGE,
  RepairStatus.WAITING_PARTS,
  RepairStatus.IN_REPAIR,
  RepairStatus.READY_FOR_DELIVERY,
];

export default async function WorkOrderDetailPage({ params, searchParams }: PageProps<"/work-orders/[id]">) {
  const { id } = await params;
  const query = await searchParams;
  const order = await prisma.repairIntake.findUnique({ where: { id }, include: { pickup: true, resolutionActions: true, asset: { include: { customer: true, location: true } } } });
  if (!order) notFound();
  const updateOrder = updateRepairIntake.bind(null, order.id);
  const disposeDevice = disposeRepairDevice.bind(null, order.id);
  const ageDays = Math.max(0, Math.floor((currentTime() - order.pickedUpAt.getTime()) / 86_400_000));
  const isClosed = order.status === RepairStatus.DELIVERED || order.status === RepairStatus.REMOVED || order.status === RepairStatus.CANCELLED;
  const canDispose = !isClosed && order.asset.disposition === AssetDisposition.ACTIVE;

  return (
    <>
      <PageHeader eyebrow="Repair record" title={order.pickup?.pickupNumber ?? order.intakeNumber} action={<Link className="button-ghost border-border" href={`/devices/${order.asset.id}`}>Back to device</Link>} />
      {query.saved === "1" && <p className="mb-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">Repair record saved.</p>}
      {typeof query.disposed === "string" && <p className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">Device marked {query.disposed}. The intake is closed and its history is retained.</p>}
      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <form action={updateOrder} className="panel">
          <div className="grid gap-4 p-4 sm:grid-cols-2">
            {isClosed ? <div className="grid gap-1 text-xs font-medium"><span>Status</span><div className="control flex items-center bg-zinc-50"><StatusBadge status={order.status} /></div></div> : <label className="grid gap-1 text-xs font-medium">Status<select className="control" defaultValue={order.status} name="status">{editableStatuses.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}</select></label>}
            <label className="grid gap-1 text-xs font-medium">Pickup date<input className="control" defaultValue={order.pickedUpAt.toISOString().slice(0, 10)} name="pickedUpAt" required type="date" />{order.pickup && <span className="text-2xs font-normal text-muted">Updates every device in {order.pickup.pickupNumber}.</span>}</label>
            <label className="grid gap-1 text-xs font-medium sm:col-span-2">Reported issue<textarea className="min-h-20 rounded-md border border-border px-2.5 py-2 text-xs" defaultValue={order.reportedIssue} name="reportedIssue" required /></label>
            <label className="grid gap-1 text-xs font-medium sm:col-span-2">Actual issue<textarea className="min-h-24 rounded-md border border-border px-2.5 py-2 text-xs" defaultValue={order.actualIssue ?? ""} name="actualIssue" /></label>
            <ResolutionSelector initialActions={order.resolutionActions.map((action) => ({ type: action.type, item: action.item }))} />
            <label className="grid gap-1 text-xs font-medium sm:col-span-2">Resolution notes<textarea className="min-h-28 rounded-md border border-border px-2.5 py-2 text-xs" defaultValue={order.resolutionNotes ?? ""} name="resolutionNotes" /></label>
          </div>
          <div className="flex justify-end border-t border-border px-4 py-3"><button className="button-primary" type="submit">Save changes</button></div>
        </form>
        <aside className="space-y-3">
          <section className="panel p-panel"><div className="flex items-center justify-between"><h2 className="text-sm font-semibold">Intake</h2><StatusBadge status={order.status} /></div><dl className="mt-3 grid grid-cols-2 gap-2 text-xs"><div><dt className="text-muted">In possession</dt><dd className="mt-0.5 font-semibold">{isClosed ? "Closed" : `${ageDays} day${ageDays === 1 ? "" : "s"}`}</dd></div><div><dt className="text-muted">Picked up</dt><dd className="mt-0.5 font-semibold">{order.pickedUpAt.toLocaleDateString()}</dd></div></dl></section>
          <section className="panel p-panel"><h2 className="text-sm font-semibold">Asset</h2><dl className="mt-3 grid gap-2 text-xs"><div><dt className="text-muted">Device</dt><dd className="font-semibold">{order.asset.rawModel ?? `${order.asset.brand} ${order.asset.family ?? ""}`}</dd></div><div><dt className="text-muted">Serial</dt><dd className="font-mono">{order.asset.serialNumber}</dd></div><div><dt className="text-muted">Customer</dt><dd>{order.asset.customer.name}</dd></div><div><dt className="text-muted">Location</dt><dd>{order.asset.location?.name ?? "Not assigned"}</dd></div>{order.asset.disposition !== AssetDisposition.ACTIVE && <div><dt className="text-muted">Disposition</dt><dd className="font-semibold capitalize">{order.asset.disposition.toLowerCase()}{order.asset.dispositionNotes ? ` · ${order.asset.dispositionNotes}` : ""}</dd></div>}</dl></section>
          {canDispose && <DisposeDeviceForm action={disposeDevice} deviceName={order.asset.assetTag ?? order.asset.serialNumber} />}
          {!isClosed && order.pickupId && <RemoveRepairForm action={removeRepairFromPickup.bind(null, order.id, false)} deviceName={order.asset.assetTag ?? order.asset.serialNumber} pickupNumber={order.pickup?.pickupNumber ?? order.intakeNumber} />}
          {order.status === RepairStatus.CANCELLED && <DeleteRepairRecordForm action={permanentlyDeleteRepairRecord.bind(null, order.id)} intakeNumber={order.intakeNumber} />}
        </aside>
      </div>
    </>
  );
}
