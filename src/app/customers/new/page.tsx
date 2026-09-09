import Link from "next/link";
import { createCustomer } from "@/app/actions";
import { PageHeader } from "@/components/page-header";

export const dynamic = "force-dynamic";

export default async function NewCustomerPage() {
  return <><PageHeader eyebrow="Directory" title="Add customer" /><form action={createCustomer} className="panel max-w-xl"><div className="grid gap-4 p-4"><label className="grid gap-1 text-xs font-medium">Customer name<input autoFocus className="control" name="name" required /></label></div><div className="flex justify-end gap-2 border-t border-border px-4 py-3"><Link className="button-ghost border-border" href="/customers">Cancel</Link><button className="button-primary" type="submit">Add customer</button></div></form></>;
}
