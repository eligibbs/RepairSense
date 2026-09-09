import { Search } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/work-order-table";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.trim() : "";
  const [orders, customers, assets] = query ? await Promise.all([
    prisma.repairIntake.findMany({ where: { OR: [{ intakeNumber: { contains: query } }, { reportedIssue: { contains: query } }, { asset: { customer: { name: { contains: query } } } }] }, include: { asset: { include: { customer: true } } }, take: 10 }),
    prisma.customer.findMany({ where: { name: { contains: query } }, take: 10 }),
    prisma.asset.findMany({ where: { OR: [{ serialNumber: { contains: query } }, { assetTag: { contains: query } }, { rawModel: { contains: query } }] }, include: { customer: true }, take: 10 }),
  ]) : [[], [], []];
  const total = orders.length + customers.length + assets.length;

  return (
    <>
      <PageHeader eyebrow="RepairSense" title="Search" />
      <form action="/search" className="panel mb-4 flex gap-2 p-panel"><label className="relative flex-1"><Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted" /><span className="sr-only">Search RepairSense</span><input autoFocus className="control w-full pl-8" defaultValue={query} name="q" placeholder="Order, customer, asset, serial, or part…" /></label><button className="button-primary" type="submit">Search</button></form>
      {query && <p className="mb-3 text-xs text-muted">{total} result{total === 1 ? "" : "s"} for “{query}”</p>}
      <div className="grid gap-3 lg:grid-cols-2">
        <section className="panel p-panel"><h2 className="text-sm font-semibold">Work orders</h2><div className="mt-2 divide-y divide-border">{orders.map((order) => <Link className="flex items-center justify-between gap-3 py-2 text-xs hover:text-primary" href={`/work-orders/${order.id}`} key={order.id}><span><strong>{order.intakeNumber}</strong> · {order.asset.customer.name}</span><StatusBadge status={order.status} /></Link>)}{query && !orders.length && <p className="py-2 text-xs text-muted">No matching work orders.</p>}</div></section>
        <section className="panel p-panel"><h2 className="text-sm font-semibold">Customers</h2><div className="mt-2 divide-y divide-border">{customers.map((customer) => <Link className="block py-2 text-xs font-medium hover:text-primary" href={`/work-orders?customer=${encodeURIComponent(customer.name)}`} key={customer.id}>{customer.name}</Link>)}{query && !customers.length && <p className="py-2 text-xs text-muted">No matching customers.</p>}</div></section>
        <section className="panel p-panel"><h2 className="text-sm font-semibold">Devices</h2><div className="mt-2 divide-y divide-border">{assets.map((asset) => <Link className="block py-2 text-xs hover:text-primary" href={`/devices/${asset.id}`} key={asset.id}><strong>{asset.rawModel ?? `${asset.brand} ${asset.family ?? ""}`}</strong><p className="text-muted">{asset.customer.name} · {asset.serialNumber}</p></Link>)}{query && !assets.length && <p className="py-2 text-xs text-muted">No matching devices.</p>}</div></section>
      </div>
    </>
  );
}
