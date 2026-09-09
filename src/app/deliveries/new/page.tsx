import Link from "next/link";
import { createStandaloneDelivery } from "@/app/actions";
import { PageHeader } from "@/components/page-header";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function NewDeliveryPage() {
  const customers = await prisma.customer.findMany({ where: { removedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } });

  return <><PageHeader eyebrow="Returns" title="New delivery" /><form action={createStandaloneDelivery} className="panel max-w-xl"><div className="grid gap-4 p-4"><label className="grid gap-1 text-xs font-medium">Customer<select autoFocus className="control" name="customerId" required><option value="">Select customer</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></label><p className="text-2xs leading-4 text-muted">This creates an empty delivery for newly supplied devices. Pickup devices are added from their pickup delivery.</p></div><div className="flex justify-end gap-2 border-t border-border px-4 py-3"><Link className="button-ghost border-border" href="/deliveries">Cancel</Link><button className="button-primary" type="submit">Create delivery</button></div></form></>;
}
