import { MapPin, Search } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { AssetDisposition, RepairStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function CustomersPage({ searchParams }: PageProps<"/customers">) {
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.trim() : "";
  const state = params.state === "removed" ? "removed" : "active";
  const customers = await prisma.customer.findMany({
    where: { removedAt: state === "removed" ? { not: null } : null, ...(query ? { OR: [{ name: { contains: query } }, { locations: { some: { name: { contains: query } } } }, { assets: { some: { serialNumber: { contains: query } } } }] } : {}) },
    include: {
      locations: true,
      _count: { select: { assets: { where: { disposition: AssetDisposition.ACTIVE } } } },
      assets: { where: { disposition: AssetDisposition.ACTIVE }, select: { repairIntakes: { where: { status: { notIn: [RepairStatus.DELIVERED, RepairStatus.REMOVED, RepairStatus.CANCELLED] } }, select: { id: true } } } },
    },
    orderBy: { name: "asc" },
  });

  return (
    <>
      <PageHeader eyebrow="Directory" title="Customers" action={<Link className="button-primary" href="/customers/new">Add customer</Link>} />
      <form action="/customers" className="panel mb-3 flex gap-2 p-panel"><label className="relative flex-1"><Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted" /><span className="sr-only">Search customers</span><input className="control w-full pl-8" defaultValue={query} name="q" placeholder="Customer, location, or asset serial…" /></label><select className="control" defaultValue={state} name="state"><option value="active">Active customers</option><option value="removed">Removed customers</option></select><button className="button-primary" type="submit">Search</button>{(query || state !== "active") && <Link className="button-ghost border-border" href="/customers">Clear</Link>}</form>
      <section className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {customers.map((customer) => {
          const openRepairs = customer.assets.reduce((total, asset) => total + asset.repairIntakes.length, 0);
          return <article className="panel p-panel" key={customer.id}><div><div className="flex items-center justify-between gap-2"><Link className="text-sm font-semibold hover:text-primary hover:underline" href={`/customers/${customer.id}`}>{customer.name}</Link>{customer.removedAt && <span className="rounded-full border border-zinc-200 bg-zinc-100 px-2 py-0.5 text-2xs font-semibold text-zinc-700">Removed</span>}</div><p className="mt-0.5 flex items-center gap-1 text-xs text-muted"><MapPin className="size-3" />{customer.locations.map((location) => location.name).join(", ") || "No location"}</p></div><div className="mt-3 flex gap-4 border-t border-border pt-2 text-xs"><span><strong>{customer._count.assets}</strong> assets</span><span><strong>{openRepairs}</strong> open repairs</span></div><div className="mt-2 grid grid-cols-2 gap-2"><Link className="button-ghost border-border" href={`/customers/${customer.id}`}>Manage</Link>{!customer.removedAt && <Link className="button-ghost border-border" href={`/devices?q=${encodeURIComponent(customer.name)}`}>View devices</Link>}</div></article>;
        })}
        {!customers.length && <p className="text-xs text-muted">No customers found.</p>}
      </section>
    </>
  );
}
