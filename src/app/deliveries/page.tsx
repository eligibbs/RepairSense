import { PackageCheck, Plus, Truck } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { DeliveryStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function DeliveriesPage({ searchParams }: PageProps<"/deliveries">) {
  const query = await searchParams;
  const deliveries = await prisma.delivery.findMany({
    include: { customer: true, pickup: { include: { customer: true } }, _count: { select: { repairs: true, items: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <>
      <PageHeader eyebrow="Returns" title="Deliveries" action={<Link className="button-primary" href="/deliveries/new"><Plus className="size-3.5" />New delivery</Link>} />
      {query.deleted === "1" && <p className="mb-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">Draft delivery deleted. Its repair devices are available on their open pickups.</p>}
      <section className="panel overflow-hidden">
        <div className="grid grid-cols-[1fr_100px_100px] border-b border-border bg-zinc-50 px-panel py-2 text-2xs font-semibold uppercase tracking-wide text-muted sm:grid-cols-[140px_1fr_120px_100px] "><span>Delivery</span><span className="hidden sm:block">Pickup</span><span>Status</span><span className="text-right">Devices</span></div>
        <div className="divide-y divide-border">
          {deliveries.map((delivery) => (
            <Link className="grid grid-cols-[1fr_100px_100px] items-center px-panel py-3 text-xs hover:bg-blue-50/50 sm:grid-cols-[140px_1fr_120px_100px]" href={`/deliveries/${delivery.id}`} key={delivery.id}>
              <strong className="text-primary">{delivery.deliveryNumber}</strong>
              <span className="hidden text-muted sm:block">{delivery.pickup ? `${delivery.pickup.pickupNumber} · ${delivery.pickup.customer.name}` : `${delivery.customer?.name ?? "Customer"} · new devices`}</span>
              <span className={`flex items-center gap-1 font-semibold ${delivery.status === DeliveryStatus.DRAFT ? "text-amber-700" : "text-emerald-700"}`}>{delivery.status === DeliveryStatus.DRAFT ? <Truck className="size-3.5" /> : <PackageCheck className="size-3.5" />}{delivery.status.toLowerCase()}</span>
              <span className="text-right font-semibold tabular-nums">{delivery._count.repairs + delivery._count.items}</span>
            </Link>
          ))}
          {!deliveries.length && <p className="p-8 text-center text-xs text-muted">No deliveries have been drafted yet.</p>}
        </div>
      </section>
    </>
  );
}
