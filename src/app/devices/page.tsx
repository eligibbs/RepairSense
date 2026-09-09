import { DeviceFilters } from "@/components/device-filters";
import { DevicePageActions } from "@/components/device-page-actions";
import { DeviceTable } from "@/components/device-table";
import { PageHeader } from "@/components/page-header";
import { AssetDisposition, RepairStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function DevicesPage({ searchParams }: PageProps<"/devices">) {
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.trim() : "";
  const state = params.state === "held" || params.state === "available" || params.state === "archived" ? params.state : "all";
  const locationId = typeof params.location === "string" ? params.location : "";
  const closedStatuses = [RepairStatus.DELIVERED, RepairStatus.REMOVED, RepairStatus.CANCELLED];
  const [devices, customers, locations] = await Promise.all([
    prisma.asset.findMany({
      where: {
        customer: { removedAt: null },
        ...(query ? { OR: [{ serialNumber: { contains: query } }, { assetTag: { contains: query } }, { rawModel: { contains: query } }, { family: { contains: query } }, { customer: { name: { contains: query } } }] } : {}),
        ...(locationId ? { locationId } : {}),
        disposition: state === "archived" ? { not: AssetDisposition.ACTIVE } : AssetDisposition.ACTIVE,
        ...(state === "held" ? { repairIntakes: { some: { status: { notIn: closedStatuses } } } } : {}),
        ...(state === "available" ? { repairIntakes: { none: { status: { notIn: closedStatuses } } } } : {}),
      },
      include: { customer: true, location: true, repairIntakes: { where: { status: { notIn: closedStatuses } }, orderBy: { pickedUpAt: "desc" }, take: 1 } },
      orderBy: [{ customer: { name: "asc" } }, { family: "asc" }, { serialNumber: "asc" }],
    }),
    prisma.customer.findMany({ where: { removedAt: null }, select: { id: true, name: true, locations: { select: { id: true, code: true, name: true }, orderBy: { code: "asc" } } }, orderBy: { name: "asc" } }),
    prisma.location.findMany({ where: { customer: { removedAt: null } }, select: { id: true, code: true, name: true }, orderBy: [{ code: "asc" }, { name: "asc" }] }),
  ]);

  return <>
    <PageHeader eyebrow="Managed assets" title="Devices" action={<DevicePageActions customers={customers} defaultCustomerId={customers.find((customer) => customer.name === "Cicero Therapies")?.id} />} />
    {params.deleted === "1" && <p className="mb-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">Device and its repair history permanently deleted.</p>}
    <section className="panel overflow-hidden">
      <DeviceFilters initialLocation={locationId} initialQuery={query} initialState={state} locations={locations} />
      <DeviceTable allowBatchRemove={state !== "archived"} devices={devices.map((device) => ({
        id: device.id,
        name: device.rawModel ?? `${device.brand} ${device.family ?? ""}`,
        customerName: device.customer.name,
        locationCode: device.location?.code ?? null,
        serialNumber: device.serialNumber,
        assetTag: device.assetTag,
        disposition: device.disposition,
        activeRepair: device.repairIntakes[0] ? { id: device.repairIntakes[0].id, intakeNumber: device.repairIntakes[0].intakeNumber } : null,
      }))} />
    </section>
  </>;
}
