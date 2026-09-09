import { ArrowLeft, Laptop } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { permanentlyDeleteDevice, restoreDevice } from "@/app/actions";
import { ArchivedDeviceActions } from "@/components/archived-device-actions";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/work-order-table";
import { AssetDisposition, RepairStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function DeviceDetailPage({ params, searchParams }: PageProps<"/devices/[id]">) {
  const { id } = await params;
  const query = await searchParams;
  const device = await prisma.asset.findUnique({ where: { id }, include: { customer: true, location: true, repairIntakes: { orderBy: { pickedUpAt: "desc" }, include: { pickup: true } } } });
  if (!device) notFound();
  const active = device.repairIntakes.find((repair) => repair.status !== RepairStatus.DELIVERED && repair.status !== RepairStatus.REMOVED && repair.status !== RepairStatus.CANCELLED);

  return (
    <>
      <PageHeader eyebrow="Device" title={device.rawModel ?? `${device.brand} ${device.family ?? ""}`} action={<Link className="button-ghost border-border" href="/devices"><ArrowLeft className="size-3.5" />All devices</Link>} />
      {query.restored === "1" && <p className="mb-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">Device restored to active customer devices and its prior repair state.</p>}
      {query.repairDeleted === "1" && <p className="mb-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">Removed-pickup repair record permanently deleted. The device remains active.</p>}
      {query.repairRemoved === "1" && <p className="mb-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">Repair record removed. This device is no longer in your possession.</p>}
      <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
        <aside className="space-y-3"><section className="panel p-panel"><div className="flex items-center gap-2"><span className="grid size-8 place-items-center rounded-md bg-primary-soft text-primary"><Laptop className="size-4" /></span><div><h2 className="text-sm font-semibold">{device.assetTag ?? "No asset tag"}</h2><p className="text-2xs text-muted">{device.disposition !== AssetDisposition.ACTIVE ? `${device.disposition.toLowerCase()} · archived` : active ? "Currently in your possession" : "Okay · not in your possession"}</p></div></div><dl className="mt-3 grid gap-2 border-t border-border pt-3 text-xs"><div><dt className="text-muted">Serial number</dt><dd className="font-mono font-semibold">{device.serialNumber}</dd></div><div><dt className="text-muted">Customer history</dt><dd className="font-semibold">{device.customer.name}</dd></div><div><dt className="text-muted">Location</dt><dd>{device.location?.name ?? "Not assigned"}</dd></div><div><dt className="text-muted">Normalized specs</dt><dd>{[device.family, device.modelYear, device.chipset].filter(Boolean).join(" · ") || "Not available"}</dd></div>{device.dispositionNotes && <div><dt className="text-muted">Disposition notes</dt><dd>{device.dispositionNotes}</dd></div>}</dl>{active && <Link className="button-primary mt-4 w-full" href={`/work-orders/${active.id}`}>Open current repair</Link>}</section>{device.disposition !== AssetDisposition.ACTIVE && <ArchivedDeviceActions deleteAction={permanentlyDeleteDevice.bind(null, device.id)} deviceName={device.assetTag ?? device.serialNumber} restoreAction={restoreDevice.bind(null, device.id)} />}</aside>
        <section className="panel overflow-hidden"><header className="border-b border-border bg-zinc-50 px-panel py-2.5"><h2 className="text-sm font-semibold">Repair history</h2><p className="text-2xs text-muted">Every recorded time this device entered your possession.</p></header><div className="divide-y divide-border">{device.repairIntakes.map((repair) => <Link className="grid gap-2 px-panel py-3 hover:bg-blue-50/50 sm:grid-cols-[128px_130px_1fr_120px] sm:items-center" href={`/work-orders/${repair.id}`} key={repair.id}><strong className="whitespace-nowrap text-xs text-primary">{repair.intakeNumber}</strong><span className="text-xs">{repair.pickedUpAt.toLocaleDateString()}</span><span className="truncate text-xs text-muted">{repair.reportedIssue}</span><StatusBadge status={repair.status} /></Link>)}{!device.repairIntakes.length && <p className="p-8 text-center text-xs text-muted">No repair history. This device is known from management data only.</p>}</div></section>
      </div>
    </>
  );
}
