import { CalendarDays, ClipboardList, Clock3, PackageCheck, Truck } from "lucide-react";
import Link from "next/link";
import { addDevicesToPickup, createDraftDelivery, removeOpenPickup, removeRepairFromPickup } from "@/app/actions";
import { AddDevicesToPickup } from "@/components/add-devices-to-pickup";
import { PageHeader } from "@/components/page-header";
import { RemovePickupForm } from "@/components/remove-pickup-form";
import { RemoveRepairButton } from "@/components/remove-repair-button";
import { StatusBadge } from "@/components/work-order-table";
import { DeliveryStatus, RepairStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
const closedStatuses = [RepairStatus.DELIVERED, RepairStatus.REMOVED, RepairStatus.CANCELLED];

function currentTime() {
  return Date.now();
}

export default async function DashboardPage({ searchParams }: PageProps<"/">) {
  const query = await searchParams;
  const pickups = await prisma.pickup.findMany({
    where: { repairs: { some: { status: { notIn: closedStatuses } } } },
    include: {
      customer: true,
      repairs: {
        where: { status: { notIn: closedStatuses } },
        include: { asset: { include: { location: true } } },
        orderBy: { intakeNumber: "asc" },
      },
      deliveries: { where: { status: DeliveryStatus.DRAFT }, select: { id: true, deliveryNumber: true } },
    },
    orderBy: { pickedUpAt: "desc" },
  });

  const now = currentTime();
  const devicesHeld = pickups.reduce((total, pickup) => total + pickup.repairs.length, 0);
  const ready = pickups.flatMap((pickup) => pickup.repairs).filter((repair) => repair.status === RepairStatus.READY_FOR_DELIVERY).length;
  const oldestDays = pickups.length ? Math.max(...pickups.map((pickup) => Math.max(0, Math.floor((now - pickup.pickedUpAt.getTime()) / 86_400_000)))) : 0;

  return (
    <>
      <PageHeader eyebrow="Operations" title="Service dashboard" />
      {query.pickupRemoved === "1" && <p className="mb-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">Pickup removed. Its devices are no longer in your possession, and the intake history was retained.</p>}
      {query.repairRemoved === "1" && <p className="mb-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">Device removed from the pickup and returned to not in your possession.</p>}
      {typeof query.devicesAdded === "string" && <p className="mb-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">Added {query.devicesAdded} device{query.devicesAdded === "1" ? "" : "s"} to the pickup.</p>}
      <section aria-label="Pickup metrics" className="grid gap-2 sm:grid-cols-3">
        {[
          { label: "Open pickups", value: pickups.length, detail: "Pickup groups still in possession", icon: ClipboardList },
          { label: "Devices in possession", value: devicesHeld, detail: `${ready} ready for delivery`, icon: PackageCheck },
          { label: "Oldest open pickup", value: `${oldestDays}d`, detail: "Age of the earliest open group", icon: Clock3 },
        ].map(({ label, value, detail, icon: Icon }) => (
          <article className="panel p-panel" key={label}><div className="flex items-center justify-between text-muted"><span className="text-xs font-medium">{label}</span><Icon className="size-4" /></div><p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight">{value}</p><p className="mt-0.5 text-xs text-muted">{detail}</p></article>
        ))}
      </section>

      <div className="mt-4 flex items-center justify-between"><div><h2 className="text-sm font-semibold">Open pickups</h2><p className="text-2xs text-muted">Devices are grouped by the date they entered your possession.</p></div></div>
      <section className="mt-2 grid gap-3">
        {pickups.map((pickup) => {
          const ageDays = Math.max(0, Math.floor((now - pickup.pickedUpAt.getTime()) / 86_400_000));
          const draft = pickup.deliveries[0];
          const draftDelivery = createDraftDelivery.bind(null, pickup.id);
          const addDevices = addDevicesToPickup.bind(null, pickup.id);
          return (
            <article className="panel overflow-hidden" id={pickup.id} key={pickup.id}>
              <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-zinc-50 px-panel py-2.5">
                <div className="flex items-center gap-3"><span className="grid size-8 place-items-center rounded-md border border-border bg-white text-primary"><CalendarDays className="size-4" /></span><div><h3 className="text-sm font-semibold">Picked up {pickup.pickedUpAt.toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "numeric" })}</h3><p className="text-2xs text-muted">{pickup.pickupNumber} · {pickup.customer.name} · held {ageDays} day{ageDays === 1 ? "" : "s"}</p></div></div>
                <div className="flex items-center gap-2"><AddDevicesToPickup action={addDevices} customerId={pickup.customerId} customerName={pickup.customer.name} pickupNumber={pickup.pickupNumber} />{draft ? <Link className="button-primary" href={`/deliveries/${draft.id}`}><Truck className="size-3.5" />Review {draft.deliveryNumber}</Link> : <form action={draftDelivery}><button className="button-primary" type="submit"><Truck className="size-3.5" />Draft delivery</button></form>}<RemovePickupForm action={removeOpenPickup.bind(null, pickup.id)} deviceCount={pickup.repairs.length} pickupNumber={pickup.pickupNumber} /></div>
              </header>
              <div className="divide-y divide-border">
                {pickup.repairs.map((repair) => (
                  <div className="grid gap-2 px-panel py-2.5 hover:bg-blue-50/50 sm:grid-cols-[128px_minmax(180px,1fr)_120px_150px_30px] sm:items-center" key={repair.id}>
                    <Link className="whitespace-nowrap text-xs font-semibold text-primary hover:underline" href={`/work-orders/${repair.id}`}>{repair.intakeNumber}</Link>
                    <Link href={`/work-orders/${repair.id}`}><strong className="block text-xs">{repair.asset.rawModel ?? `${repair.asset.brand} ${repair.asset.family ?? ""}`}</strong><span className="text-2xs text-muted">{repair.asset.location?.code ?? "No location"} · {repair.asset.serialNumber}</span></Link>
                    <Link href={`/work-orders/${repair.id}`}><StatusBadge status={repair.status} /></Link>
                    <Link className="truncate text-xs text-muted" href={`/work-orders/${repair.id}`}>{repair.reportedIssue}</Link>
                    <RemoveRepairButton action={removeRepairFromPickup.bind(null, repair.id, true)} deviceName={repair.asset.assetTag ?? repair.asset.serialNumber} pickupNumber={pickup.pickupNumber} />
                  </div>
                ))}
              </div>
            </article>
          );
        })}
        {!pickups.length && <div className="panel p-8 text-center"><PackageCheck className="mx-auto size-6 text-muted" /><p className="mt-2 text-sm font-semibold">No open pickups</p><p className="text-xs text-muted">All collected devices have been returned.</p></div>}
      </section>
    </>
  );
}
