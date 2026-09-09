import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createLocation, removeCustomer, restoreCustomer, updateLocation } from "@/app/actions";
import { CustomerLifecycleActions } from "@/components/customer-lifecycle-actions";
import { LocationManager } from "@/components/location-manager";
import { PageHeader } from "@/components/page-header";
import { AssetDisposition } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function CustomerDetailPage({ params, searchParams }: PageProps<"/customers/[id]">) {
  const { id } = await params;
  const query = await searchParams;
  const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        locations: {
          include: { _count: { select: { assets: { where: { disposition: AssetDisposition.ACTIVE } } } } },
          orderBy: { code: "asc" },
        },
        _count: { select: { assets: { where: { disposition: AssetDisposition.ACTIVE } }, pickups: true } },
      },
    });
  if (!customer) notFound();

  return <>
    <PageHeader eyebrow="Customer" title={customer.name} action={<Link className="button-ghost border-border" href="/customers"><ArrowLeft className="size-3.5" />All customers</Link>} />
    {query.restored === "1" && <p className="mb-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">Customer restored to active workflows.</p>}
    <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
      <LocationManager
        addAction={createLocation.bind(null, customer.id)}
        locations={customer.locations.map((location) => ({ id: location.id, code: location.code, name: location.name, deviceCount: location._count.assets }))}
        updateAction={updateLocation.bind(null, customer.id)}
      />
      <aside className="space-y-3">
        <section className="panel p-panel"><h2 className="text-sm font-semibold">Customer summary</h2><dl className="mt-3 grid grid-cols-2 gap-2 text-xs"><div><dt className="text-muted">Devices</dt><dd className="text-lg font-semibold">{customer._count.assets}</dd></div><div><dt className="text-muted">Pickups</dt><dd className="text-lg font-semibold">{customer._count.pickups}</dd></div></dl><Link className="button-ghost mt-3 w-full border-border" href={`/devices?q=${encodeURIComponent(customer.name)}`}>View customer devices</Link></section>
        <CustomerLifecycleActions customerName={customer.name} removeAction={removeCustomer.bind(null, customer.id)} removed={Boolean(customer.removedAt)} restoreAction={restoreCustomer.bind(null, customer.id)} />
      </aside>
    </div>
  </>;
}
