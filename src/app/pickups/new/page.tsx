import { PageHeader } from "@/components/page-header";
import { NewPickupForm } from "@/components/new-pickup-form";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function currentDate() {
  return new Date().toISOString().slice(0, 10);
}

export default async function NewPickupPage() {
  const customers = await prisma.customer.findMany({ where: { removedAt: null }, select: { id: true, name: true, locations: { select: { id: true, code: true, name: true }, orderBy: { code: "asc" } } }, orderBy: { name: "asc" } });
  return <><PageHeader eyebrow="Custody" title="New pickup" /><NewPickupForm customers={customers} defaultDate={currentDate()} /></>;
}
