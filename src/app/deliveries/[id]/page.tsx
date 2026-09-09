import { ArrowLeft, PackageCheck, Plus, RotateCcw, Trash2, Truck } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { addRepairToDelivery, addSaleDevice, deleteDraftDelivery, finalizeDelivery, removeRepairFromDelivery, removeSaleDevice, reopenDelivery, updateDeliveryNotes } from "@/app/actions";
import { AddSaleDeviceForm } from "@/components/add-sale-device-form";
import { DeleteDeliveryForm } from "@/components/delete-delivery-form";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/work-order-table";
import { AssetDisposition, DeliveryStatus, RepairStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function DeliveryDetailPage({ params, searchParams }: PageProps<"/deliveries/[id]">) {
  const { id } = await params;
  const query = await searchParams;
  const delivery = await prisma.delivery.findUnique({
    where: { id },
    include: {
      customer: { include: { locations: { orderBy: { code: "asc" } } } },
      repairs: { include: { asset: { include: { location: true } }, pickup: true }, orderBy: { intakeNumber: "asc" } },
      items: { include: { asset: { include: { location: true } } } },
      pickup: { include: { customer: { include: { locations: { orderBy: { code: "asc" } } } } } },
    },
  });
  if (!delivery) notFound();

  const customer = delivery.customer ?? delivery.pickup?.customer ?? null;
  const availableRepairs = delivery.pickup && customer ? await prisma.repairIntake.findMany({
    where: { deliveryId: null, status: { notIn: [RepairStatus.DELIVERED, RepairStatus.REMOVED, RepairStatus.CANCELLED] }, asset: { customerId: customer.id, disposition: "ACTIVE" } },
    include: { asset: { include: { location: true } }, pickup: true },
    orderBy: [{ pickedUpAt: "asc" }, { intakeNumber: "asc" }],
  }) : [];
  const isDraft = delivery.status === DeliveryStatus.DRAFT;
  const deviceCount = delivery.repairs.length + delivery.items.length;
  const recycledCount = delivery.repairs.filter((repair) => repair.asset.disposition === AssetDisposition.RECYCLED).length;
  const returnedRepairCount = delivery.repairs.length - recycledCount;
  const completionParts = [
    returnedRepairCount ? `${returnedRepairCount} returned repair device${returnedRepairCount === 1 ? "" : "s"}` : null,
    recycledCount ? `${recycledCount} recycled device${recycledCount === 1 ? "" : "s"}` : null,
    delivery.items.length ? `${delivery.items.length} new device${delivery.items.length === 1 ? "" : "s"}` : null,
  ].filter(Boolean).join(", ");

  return (
    <>
      <PageHeader eyebrow="Delivery" title={delivery.deliveryNumber} action={<Link className="button-ghost border-border" href="/deliveries"><ArrowLeft className="size-3.5" />All deliveries</Link>} />
      {query.completed === "1" && <p className="mb-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">Delivery completed. Included devices are no longer in possession.</p>}
      {query.reopened === "1" && <p className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">Delivery reopened. Repair devices are back in your possession so you can correct the delivery.</p>}
      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          {isDraft && customer && <section className="panel overflow-hidden">
            <header className="border-b border-border bg-zinc-50 px-panel py-2.5"><h2 className="text-sm font-semibold">Add new device</h2><p className="text-2xs text-muted">Record a newly supplied device directly on this delivery.</p></header>
            <AddSaleDeviceForm action={addSaleDevice.bind(null, delivery.id)} locations={customer.locations} />
          </section>}

          <section className="panel overflow-hidden">
            <header className="border-b border-border bg-zinc-50 px-panel py-2.5"><h2 className="text-sm font-semibold">Delivery notes</h2><p className="text-2xs text-muted">Internal context or delivery details that should remain with this record.</p></header>
            <form action={updateDeliveryNotes.bind(null, delivery.id)} className="p-panel">
              <label className="sr-only" htmlFor="delivery-notes">Delivery notes</label>
              <textarea className="min-h-28 w-full resize-y rounded-md border border-border bg-white px-2.5 py-2 text-xs outline-none focus:border-primary focus:ring-2 focus:ring-blue-100" defaultValue={delivery.notes ?? ""} id="delivery-notes" maxLength={10_000} name="notes" placeholder="Add notes for this delivery…" />
              <div className="mt-2 flex justify-end"><button className="button-primary" type="submit">Save notes</button></div>
            </form>
          </section>

          <section className="panel overflow-hidden">
            <header className="flex items-center justify-between border-b border-border bg-zinc-50 px-panel py-2.5"><div><h2 className="text-sm font-semibold">Devices in this delivery</h2><p className="text-2xs text-muted">Repair returns, recycled devices, and new devices are kept in one list.</p></div><span className="text-xs font-semibold tabular-nums">{deviceCount}</span></header>
            <div className="divide-y divide-border">
              {delivery.repairs.map((repair) => <div className="grid gap-2 px-panel py-3 sm:grid-cols-[90px_1fr_120px_38px] sm:items-center" key={repair.id}><Link className="text-xs font-semibold text-primary hover:underline" href={`/work-orders/${repair.id}`}>{repair.intakeNumber}</Link><div><p className="text-xs font-semibold">{repair.asset.rawModel ?? `${repair.asset.brand} ${repair.asset.family ?? ""}`}</p><p className="text-2xs text-muted">{repair.asset.location?.code ?? "No location"} · {repair.asset.serialNumber}</p></div>{isDraft && repair.asset.disposition === AssetDisposition.RECYCLED ? <span className="w-fit rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-2xs font-semibold text-amber-700">Recycled</span> : <StatusBadge status={repair.status} />}{isDraft && repair.asset.disposition !== AssetDisposition.RECYCLED && <form action={removeRepairFromDelivery.bind(null, delivery.id, repair.id)}><button aria-label={`Remove ${repair.intakeNumber} from delivery`} className="grid size-7 place-items-center rounded-md border border-border text-muted hover:border-red-200 hover:bg-red-50 hover:text-red-700" type="submit"><Trash2 className="size-3.5" /></button></form>}</div>)}
              {delivery.items.map((item) => <div className="grid gap-2 px-panel py-3 sm:grid-cols-[90px_1fr_120px_38px] sm:items-center" key={item.id}><span className="text-xs font-semibold text-primary">New</span><div><Link className="text-xs font-semibold hover:underline" href={`/devices/${item.asset.id}`}>{item.asset.rawModel ?? `${item.asset.brand} ${item.asset.family ?? ""}`}</Link><p className="text-2xs text-muted">{item.asset.location?.code ?? "No location"} · {item.asset.serialNumber}</p></div><span className="w-fit rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-2xs font-semibold text-emerald-700">New</span>{isDraft && <form action={removeSaleDevice.bind(null, delivery.id, item.id)}><button aria-label={`Remove ${item.asset.serialNumber} from delivery`} className="grid size-7 place-items-center rounded-md border border-border text-muted hover:border-red-200 hover:bg-red-50 hover:text-red-700" type="submit"><Trash2 className="size-3.5" /></button></form>}</div>)}
              {!deviceCount && <p className="p-6 text-center text-xs text-muted">No devices are currently included.</p>}
            </div>
          </section>

          {isDraft && availableRepairs.length > 0 && <section className="panel overflow-hidden"><header className="border-b border-border bg-zinc-50 px-panel py-2.5"><h2 className="text-sm font-semibold">Available from open pickups</h2><p className="text-2xs text-muted">Add a device from any open pickup for {customer?.name}.</p></header><div className="divide-y divide-border">{availableRepairs.map((repair) => <div className="grid gap-2 px-panel py-3 sm:grid-cols-[90px_1fr_120px_38px] sm:items-center" key={repair.id}><Link className="text-xs font-semibold text-primary" href={`/work-orders/${repair.id}`}>{repair.intakeNumber}</Link><div><p className="text-xs font-semibold">{repair.asset.rawModel ?? `${repair.asset.brand} ${repair.asset.family ?? ""}`}</p><p className="text-2xs text-muted">{repair.pickup?.pickupNumber ?? "Pickup"} · {repair.asset.location?.code ?? "No location"} · {repair.reportedIssue}</p></div><StatusBadge status={repair.status} /><form action={addRepairToDelivery.bind(null, delivery.id, repair.id)}><button aria-label={`Add ${repair.intakeNumber} to delivery`} className="grid size-7 place-items-center rounded-md border border-border text-primary hover:bg-primary-soft" type="submit"><Plus className="size-3.5" /></button></form></div>)}</div></section>}
        </div>

        <aside className="space-y-3">
          <section className="panel p-panel"><div className="flex items-center gap-2"><span className={`grid size-8 place-items-center rounded-md ${isDraft ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>{isDraft ? <Truck className="size-4" /> : <PackageCheck className="size-4" />}</span><div><h2 className="text-sm font-semibold capitalize">{delivery.status.toLowerCase()}</h2><p className="text-2xs text-muted">{delivery.pickup?.pickupNumber ?? "New devices only"}</p></div></div><dl className="mt-3 grid gap-2 border-t border-border pt-3 text-xs"><div><dt className="text-muted">Customer</dt><dd className="font-semibold">{customer?.name ?? "—"}</dd></div>{delivery.pickup && <div><dt className="text-muted">Pickup date</dt><dd className="font-semibold">{delivery.pickup.pickedUpAt.toLocaleDateString()}</dd></div>}{delivery.deliveredAt && <div><dt className="text-muted">Delivered</dt><dd className="font-semibold">{delivery.deliveredAt.toLocaleString()}</dd></div>}</dl></section>
          {isDraft && <form action={finalizeDelivery.bind(null, delivery.id)} className="panel p-panel"><button className="button-primary w-full" disabled={!deviceCount} type="submit"><PackageCheck className="size-3.5" />Complete delivery</button><p className="mt-2 text-2xs leading-4 text-muted">Completing this delivery records {completionParts || "these devices"} as delivered. Repairs removed from the delivery remain on their open pickups.</p></form>}
          {isDraft && <section className="panel p-panel"><DeleteDeliveryForm action={deleteDraftDelivery.bind(null, delivery.id)} deliveryNumber={delivery.deliveryNumber} /><p className="mt-2 text-2xs leading-4 text-muted">Deletes this draft, releases its pickup devices, and removes unsent new-device entries.</p></section>}
          {!isDraft && delivery.status === DeliveryStatus.DELIVERED && <form action={reopenDelivery.bind(null, delivery.id)} className="panel p-panel"><button className="button-ghost w-full border-border" type="submit"><RotateCcw className="size-3.5" />Reopen delivery</button><p className="mt-2 text-2xs leading-4 text-muted">Reopening returns the repair devices to your possession and lets you correct this delivery.</p></form>}
        </aside>
      </div>
    </>
  );
}
