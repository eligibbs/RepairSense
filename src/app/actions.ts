"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Prisma } from "@/generated/prisma/client";
import { AssetDisposition, DeliveryStatus, RepairStatus, ResolutionItem, ResolutionType } from "@/generated/prisma/enums";
import { requireAuthenticatedUser } from "@/lib/auth-guard";
import { importNinjaDevices, type DeviceImportResult } from "@/lib/import-ninja-devices";
import { normalizeNinjaDevice } from "@/lib/normalizeDevice";
import { prisma } from "@/lib/prisma";

const editableRepairStatuses = new Set<string>([
  RepairStatus.IN_POSSESSION,
  RepairStatus.IN_TRIAGE,
  RepairStatus.WAITING_PARTS,
  RepairStatus.IN_REPAIR,
  RepairStatus.READY_FOR_DELIVERY,
]);
const closedRepairStatuses: RepairStatus[] = [RepairStatus.DELIVERED, RepairStatus.REMOVED, RepairStatus.CANCELLED];
const resolutionItemsByType: Record<ResolutionType, Set<ResolutionItem>> = {
  [ResolutionType.REPLACE_DEVICE]: new Set(),
  [ResolutionType.REPLACE_PART]: new Set([
    ResolutionItem.SCREEN, ResolutionItem.BATTERY, ResolutionItem.IO_BOARD, ResolutionItem.MAIN_BOARD,
    ResolutionItem.CHARGER_PORT, ResolutionItem.SPEAKER, ResolutionItem.RAM, ResolutionItem.DRIVE,
    ResolutionItem.FRAME, ResolutionItem.KEYBOARD, ResolutionItem.TRACKPAD, ResolutionItem.TOUCH_DIGITIZER,
    ResolutionItem.CAMERA, ResolutionItem.MICROPHONE, ResolutionItem.FAN, ResolutionItem.HEATSINK,
    ResolutionItem.HINGE, ResolutionItem.DISPLAY_CABLE, ResolutionItem.WIFI_CARD, ResolutionItem.OTHER,
  ]),
  [ResolutionType.RESET]: new Set([ResolutionItem.FACTORY_RESET, ResolutionItem.SMC, ResolutionItem.PRAM, ResolutionItem.SOFT_RESET]),
  [ResolutionType.MISC]: new Set([ResolutionItem.ENROLL, ResolutionItem.INSTALL]),
};

function requiredString(formData: FormData, key: string): string {
  const value = formData.get(key);
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${key} is required.`);
  }
  return value.trim();
}

async function createNumberedDelivery(
  transaction: Prisma.TransactionClient,
  data: Omit<Prisma.DeliveryUncheckedCreateInput, "deliveryNumber">,
) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const deliveries = await transaction.delivery.findMany({ select: { deliveryNumber: true } });
    const highestSequence = deliveries.reduce((highest, delivery) => {
      const match = /^DL-(\d+)$/.exec(delivery.deliveryNumber);
      return match ? Math.max(highest, Number.parseInt(match[1], 10)) : highest;
    }, 0);
    try {
      return await transaction.delivery.create({
        data: { ...data, deliveryNumber: `DL-${String(highestSequence + 1).padStart(4, "0")}` },
      });
    } catch (error) {
      if (!(typeof error === "object" && error && "code" in error && error.code === "P2002")) throw error;
    }
  }
  throw new Error("Could not reserve the next delivery number. Please try again.");
}

export interface CreateDeviceState {
  error?: string;
  device?: { id: string; name: string; serialNumber: string; assetTag: string | null; location: string | null };
}

export interface UpdateDeviceState {
  error?: string;
  saved?: boolean;
}

export async function updateDeviceDetails(assetId: string, _state: UpdateDeviceState, formData: FormData): Promise<UpdateDeviceState> {
  await requireAuthenticatedUser();
  const brandInput = String(formData.get("brand") ?? "").trim();
  const modelInput = String(formData.get("family") ?? "").trim();
  const serialNumber = String(formData.get("serialNumber") ?? "").trim();
  const assetTag = String(formData.get("assetTag") ?? "").trim() || null;
  const locationId = String(formData.get("locationId") ?? "").trim() || null;
  const modelYearInput = String(formData.get("modelYear") ?? "").trim();
  const chipsetInput = String(formData.get("chipset") ?? "").trim();
  if (!brandInput || !modelInput || !serialNumber) return { error: "Brand, model, and serial number are required." };
  if (brandInput.length > 100 || modelInput.length > 300 || serialNumber.length > 200 || (assetTag?.length ?? 0) > 200 || chipsetInput.length > 200) return { error: "One or more device details are too long." };
  const modelYear = modelYearInput ? Number(modelYearInput) : null;
  if (modelYear !== null && (!Number.isInteger(modelYear) || modelYear < 1970 || modelYear > new Date().getFullYear() + 1)) return { error: "Enter a valid four-digit model year." };

  const device = await prisma.asset.findUnique({ where: { id: assetId }, select: { customerId: true } });
  if (!device) return { error: "This device no longer exists." };
  if (locationId) {
    const location = await prisma.location.findFirst({ where: { id: locationId, customerId: device.customerId }, select: { id: true } });
    if (!location) return { error: "Select a location belonging to this customer." };
  }
  const duplicate = await prisma.asset.findFirst({
    where: { id: { not: assetId }, OR: [{ serialNumber }, ...(assetTag ? [{ assetTag }] : [])] },
    select: { serialNumber: true, assetTag: true },
  });
  if (duplicate?.serialNumber === serialNumber) return { error: `Serial number ${serialNumber} is already assigned.` };
  if (assetTag && duplicate?.assetTag === assetTag) return { error: `Asset tag ${assetTag} is already assigned.` };

  const specs = normalizeNinjaDevice({ deviceMake: brandInput, deviceModel: modelInput, processorsName: chipsetInput });
  try {
    await prisma.asset.update({
      where: { id: assetId },
      data: {
        brand: specs.brand,
        family: specs.family,
        rawModel: modelInput,
        modelYear: modelYear ?? specs.modelYear,
        chipset: chipsetInput || specs.chipset,
        serialNumber,
        assetTag,
        locationId,
      },
    });
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "P2002") return { error: "That serial number or asset tag was assigned by another request." };
    throw error;
  }
  revalidatePath("/");
  revalidatePath("/devices");
  revalidatePath(`/devices/${assetId}`);
  revalidatePath("/deliveries");
  return { saved: true };
}

export async function createManagedDevice(_state: CreateDeviceState, formData: FormData): Promise<CreateDeviceState> {
  await requireAuthenticatedUser();
  const customerId = String(formData.get("customerId") ?? "").trim();
  const brandInput = String(formData.get("brand") ?? "").trim();
  const modelInput = String(formData.get("family") ?? "").trim();
  const serialNumber = String(formData.get("serialNumber") ?? "").trim();
  const assetTag = String(formData.get("assetTag") ?? "").trim() || null;
  const locationId = String(formData.get("locationId") ?? "").trim() || null;
  if (!customerId || !brandInput || !modelInput || !serialNumber) return { error: "Customer, brand, model, and serial number are required." };
  const customer = await prisma.customer.findFirst({ where: { id: customerId, removedAt: null }, select: { id: true } });
  if (!customer) return { error: "Select a valid customer." };
  const location = locationId ? await prisma.location.findFirst({ where: { id: locationId, customerId }, select: { id: true, code: true } }) : null;
  if (locationId && !location) return { error: "The selected location does not belong to this customer." };
  const existing = await prisma.asset.findFirst({ where: { OR: [{ serialNumber }, ...(assetTag ? [{ assetTag }] : [])] }, select: { serialNumber: true, assetTag: true } });
  if (existing?.serialNumber === serialNumber) return { error: `Serial number ${serialNumber} is already assigned.` };
  if (assetTag && existing?.assetTag === assetTag) return { error: `Asset tag ${assetTag} is already assigned.` };
  const specs = normalizeNinjaDevice({ deviceMake: brandInput, deviceModel: modelInput });

  try {
    const device = await prisma.asset.create({
      data: {
        serialNumber,
        assetTag,
        brand: specs.brand,
        family: specs.family,
        modelYear: specs.modelYear,
        chipset: specs.chipset,
        rawModel: modelInput,
        customerId,
        locationId,
      },
    });
    revalidatePath("/devices");
    revalidatePath("/pickups/new");
    return { device: { id: device.id, name: device.rawModel ?? `${device.brand} ${device.family ?? ""}`, serialNumber: device.serialNumber, assetTag: device.assetTag, location: location?.code ?? null } };
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "P2002") return { error: "That serial number or asset tag was assigned by another request." };
    throw error;
  }
}

export interface CsvImportState { error?: string; result?: DeviceImportResult }

export async function importDeviceCsv(_state: CsvImportState, formData: FormData): Promise<CsvImportState> {
  await requireAuthenticatedUser();
  const customerId = String(formData.get("customerId") ?? "").trim();
  const file = formData.get("file");
  if (!customerId) return { error: "Select a customer for this import." };
  if (!(file instanceof File) || !file.size) return { error: "Choose a NinjaOne CSV export." };
  if (file.size > 900_000) return { error: "The CSV must be smaller than 900 KB." };
  try {
    const result = await importNinjaDevices(await file.text(), customerId);
    revalidatePath("/devices");
    revalidatePath("/customers");
    revalidatePath("/pickups/new");
    return { result };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "The CSV could not be imported." };
  }
}

export async function createPickup(formData: FormData) {
  await requireAuthenticatedUser();
  const customerId = requiredString(formData, "customerId");
  const pickedUpDate = requiredString(formData, "pickedUpAt");
  const assetIds = formData.getAll("assetId").filter((value): value is string => typeof value === "string" && Boolean(value));
  if (!assetIds.length) throw new Error("Select at least one device for this pickup.");

  const assets = await prisma.asset.findMany({
    where: { id: { in: assetIds }, customerId, disposition: AssetDisposition.ACTIVE },
    include: { repairIntakes: { where: { status: { notIn: closedRepairStatuses } }, select: { id: true } } },
  });
  if (assets.length !== new Set(assetIds).size || assets.some((asset) => asset.customerId !== customerId)) {
    throw new Error("Every selected device must belong to the selected customer.");
  }
  if (assets.some((asset) => asset.repairIntakes.length)) throw new Error("One or more selected devices are already in your possession.");

  const pickupBase = `PU-${pickedUpDate.replaceAll("-", "")}`;
  const existingPickupNumbers = await prisma.pickup.findMany({ where: { pickupNumber: { startsWith: `${pickupBase}-` } }, select: { pickupNumber: true } });
  const pickupSequence = existingPickupNumbers.reduce((largest, pickup) => {
    const value = Number.parseInt(pickup.pickupNumber.slice(pickupBase.length + 1), 10);
    return Number.isNaN(value) ? largest : Math.max(largest, value);
  }, 0) + 1;
  const pickedUpAt = new Date(`${pickedUpDate}T12:00:00`);
  const pickupNumber = `${pickupBase}-${String(pickupSequence).padStart(2, "0")}`;

  const pickup = await prisma.$transaction(async (transaction) => {
    const created = await transaction.pickup.create({
      data: {
        pickupNumber,
        customerId,
        pickedUpAt,
      },
    });
    for (const asset of assets) {
      const issue = String(formData.get(`issue:${asset.id}`) ?? "").trim() || "Not yet documented";
      await transaction.repairIntake.create({
        data: {
          intakeNumber: pickupNumber,
          assetId: asset.id,
          pickupId: created.id,
          pickedUpAt,
          reportedIssue: issue,
        },
      });
    }
    return created;
  });

  revalidatePath("/");
  revalidatePath("/devices");
  redirect(`/#${pickup.id}`);
}

export async function addDevicesToPickup(pickupId: string, formData: FormData) {
  await requireAuthenticatedUser();
  const assetIds = [...new Set(formData.getAll("assetId").filter((value): value is string => typeof value === "string" && Boolean(value)))];
  if (!assetIds.length) throw new Error("Select at least one device to add.");

  const pickup = await prisma.pickup.findFirstOrThrow({
    where: { id: pickupId, repairs: { some: { status: { notIn: closedRepairStatuses } } } },
    include: { deliveries: { where: { status: DeliveryStatus.DRAFT }, select: { id: true }, take: 1 } },
  });
  const assets = await prisma.asset.findMany({
    where: {
      id: { in: assetIds },
      customerId: pickup.customerId,
      disposition: AssetDisposition.ACTIVE,
      repairIntakes: { none: { status: { notIn: closedRepairStatuses } } },
    },
    select: { id: true },
  });
  if (assets.length !== assetIds.length) throw new Error("One or more selected devices are unavailable or belong to another customer.");

  await prisma.repairIntake.createMany({
    data: assets.map((asset) => ({
      intakeNumber: pickup.pickupNumber,
      assetId: asset.id,
      pickupId: pickup.id,
      pickedUpAt: pickup.pickedUpAt,
      reportedIssue: String(formData.get(`issue:${asset.id}`) ?? "").trim() || "Not yet documented",
      deliveryId: pickup.deliveries[0]?.id ?? null,
    })),
  });

  revalidatePath("/");
  revalidatePath("/devices");
  revalidatePath("/customers");
  if (pickup.deliveries[0]) {
    revalidatePath("/deliveries");
    revalidatePath(`/deliveries/${pickup.deliveries[0].id}`);
  }
  redirect(`/?devicesAdded=${assets.length}#${pickup.id}`);
}

export async function createCustomer(formData: FormData) {
  await requireAuthenticatedUser();
  const name = requiredString(formData, "name");
  const customer = await prisma.customer.create({ data: { name } });
  revalidatePath("/customers");
  redirect(`/customers/${customer.id}`);
}

export async function createLocation(customerId: string, formData: FormData) {
  await requireAuthenticatedUser();
  const code = requiredString(formData, "code").toUpperCase();
  const name = requiredString(formData, "name");
  await prisma.location.create({ data: { customerId, code, name } });
  revalidatePath("/customers");
  revalidatePath(`/customers/${customerId}`);
}

export async function updateLocation(customerId: string, locationId: string, formData: FormData) {
  await requireAuthenticatedUser();
  const code = requiredString(formData, "code").toUpperCase();
  const name = requiredString(formData, "name");
  const result = await prisma.location.updateMany({ where: { id: locationId, customerId }, data: { code, name } });
  if (!result.count) throw new Error("Location not found for this customer.");
  revalidatePath("/customers");
  revalidatePath(`/customers/${customerId}`);
  revalidatePath("/devices");
}

export async function updateRepairIntake(intakeId: string, formData: FormData) {
  await requireAuthenticatedUser();
  const intake = await prisma.repairIntake.findUniqueOrThrow({ where: { id: intakeId }, select: { status: true, pickupId: true } });
  const requestedStatus = String(formData.get("status") ?? "");
  const status = closedRepairStatuses.includes(intake.status) ? intake.status : requestedStatus;
  if (!closedRepairStatuses.includes(intake.status) && !editableRepairStatuses.has(status)) throw new Error("Invalid repair status.");
  const reportedIssue = requiredString(formData, "reportedIssue");
  const pickedUpDate = requiredString(formData, "pickedUpAt");
  const actualIssue = String(formData.get("actualIssue") ?? "").trim() || null;
  const resolutionActions = [...new Set(formData.getAll("resolutionAction").map(String))].map((encoded) => {
    const [typeValue, itemValue, extra] = encoded.split(":");
    if (extra !== undefined || !Object.values(ResolutionType).includes(typeValue as ResolutionType)) throw new Error("Invalid resolution action.");
    const type = typeValue as ResolutionType;
    if (type === ResolutionType.REPLACE_DEVICE) {
      if (itemValue) throw new Error("Replace device does not accept a detail.");
      return { type, item: null };
    }
    if (!itemValue || !Object.values(ResolutionItem).includes(itemValue as ResolutionItem) || !resolutionItemsByType[type].has(itemValue as ResolutionItem)) {
      throw new Error("Select a valid detail for each resolution action.");
    }
    return { type, item: itemValue as ResolutionItem };
  });
  if (resolutionActions.some((action) => action.type === ResolutionType.REPLACE_DEVICE) && resolutionActions.length > 1) {
    throw new Error("Replace device cannot be combined with another resolution action.");
  }
  const resolutionNotes = String(formData.get("resolutionNotes") ?? "").trim() || null;

  const pickedUpAt = new Date(`${pickedUpDate}T12:00:00`);
  const intakeChanges = {
      status: status as RepairStatus,
      reportedIssue,
      actualIssue,
      resolutionActions: {
        deleteMany: {},
        create: resolutionActions,
      },
      resolutionNotes,
  };
  if (intake.pickupId) {
    await prisma.$transaction([
      prisma.pickup.update({ where: { id: intake.pickupId }, data: { pickedUpAt } }),
      prisma.repairIntake.updateMany({ where: { pickupId: intake.pickupId }, data: { pickedUpAt } }),
      prisma.repairIntake.update({ where: { id: intakeId }, data: intakeChanges }),
    ]);
  } else {
    await prisma.repairIntake.update({ where: { id: intakeId }, data: { ...intakeChanges, pickedUpAt } });
  }

  revalidatePath("/");
  revalidatePath("/work-orders");
  revalidatePath(`/work-orders/${intakeId}`);
  redirect(`/work-orders/${intakeId}?saved=1`);
}

export async function createDraftDelivery(pickupId: string) {
  await requireAuthenticatedUser();
  const existing = await prisma.delivery.findFirst({
    where: { pickupId, status: DeliveryStatus.DRAFT },
    select: { id: true },
  });
  if (existing) redirect(`/deliveries/${existing.id}`);

  const pickup = await prisma.pickup.findUniqueOrThrow({
    where: { id: pickupId },
    include: {
      repairs: {
        where: {
          deliveryId: null,
          OR: [
            { status: { notIn: closedRepairStatuses } },
            { status: RepairStatus.REMOVED, asset: { disposition: AssetDisposition.RECYCLED } },
          ],
        },
        select: { id: true },
      },
    },
  });
  if (!pickup.repairs.length) throw new Error("This pickup has no available devices to deliver.");

  const delivery = await prisma.$transaction(async (transaction) => {
    const draft = await createNumberedDelivery(transaction, {
      pickupId,
      customerId: pickup.customerId,
    });
    await transaction.repairIntake.updateMany({
      where: { id: { in: pickup.repairs.map((repair) => repair.id) } },
      data: { deliveryId: draft.id },
    });
    return draft;
  });

  revalidatePath("/");
  revalidatePath("/deliveries");
  redirect(`/deliveries/${delivery.id}`);
}

export async function removeOpenPickup(pickupId: string) {
  await requireAuthenticatedUser();
  const pickup = await prisma.pickup.findUniqueOrThrow({
    where: { id: pickupId },
    include: {
      repairs: { where: { status: { notIn: closedRepairStatuses } }, select: { id: true, deliveryId: true } },
      deliveries: { where: { status: DeliveryStatus.DRAFT }, select: { id: true } },
    },
  });
  if (!pickup.repairs.length) throw new Error("This pickup is no longer open.");
  const deliveryIds = new Set([
    ...pickup.deliveries.map((delivery) => delivery.id),
    ...pickup.repairs.flatMap((repair) => repair.deliveryId ? [repair.deliveryId] : []),
  ]);

  await prisma.$transaction(async (transaction) => {
    await transaction.repairIntake.updateMany({
      where: { id: { in: pickup.repairs.map((repair) => repair.id) } },
      data: { status: RepairStatus.CANCELLED, deliveryId: null, statusBeforeRemoval: null },
    });
    for (const deliveryId of deliveryIds) {
      const delivery = await transaction.delivery.findUnique({
        where: { id: deliveryId },
        include: { _count: { select: { repairs: true, items: true } } },
      });
      if (delivery?.status === DeliveryStatus.DRAFT && !delivery._count.repairs && !delivery._count.items) {
        await transaction.delivery.delete({ where: { id: delivery.id } });
      }
    }
  });

  revalidatePath("/");
  revalidatePath("/devices");
  revalidatePath("/deliveries");
  revalidatePath("/customers");
  redirect("/?pickupRemoved=1");
}

export async function permanentlyDeleteRepairRecord(intakeId: string) {
  await requireAuthenticatedUser();
  const intake = await prisma.repairIntake.findFirstOrThrow({
    where: { id: intakeId, status: RepairStatus.CANCELLED },
    select: { assetId: true, pickupId: true },
  });
  await prisma.$transaction(async (transaction) => {
    await transaction.repairIntake.delete({ where: { id: intakeId } });
    if (intake.pickupId) {
      const pickup = await transaction.pickup.findUnique({
        where: { id: intake.pickupId },
        include: { _count: { select: { repairs: true, deliveries: true } } },
      });
      if (pickup && !pickup._count.repairs && !pickup._count.deliveries) await transaction.pickup.delete({ where: { id: pickup.id } });
    }
  });
  revalidatePath("/");
  revalidatePath("/devices");
  revalidatePath(`/devices/${intake.assetId}`);
  redirect(`/devices/${intake.assetId}?repairDeleted=1`);
}

export async function removeRepairFromPickup(intakeId: string, returnToDashboard: boolean, formData: FormData) {
  await requireAuthenticatedUser();
  void formData;
  const intake = await prisma.repairIntake.findFirstOrThrow({
    where: { id: intakeId, pickupId: { not: null }, status: { notIn: closedRepairStatuses } },
    select: { assetId: true, pickupId: true, deliveryId: true },
  });

  await prisma.$transaction(async (transaction) => {
    const deleted = await transaction.repairIntake.deleteMany({
      where: { id: intakeId, status: { notIn: closedRepairStatuses } },
    });
    if (deleted.count !== 1) throw new Error("This repair record is no longer part of an open pickup.");

    if (intake.deliveryId) {
      const delivery = await transaction.delivery.findUnique({
        where: { id: intake.deliveryId },
        include: { _count: { select: { repairs: true, items: true } } },
      });
      if (delivery?.status === DeliveryStatus.DRAFT && !delivery._count.repairs && !delivery._count.items) {
        await transaction.delivery.delete({ where: { id: delivery.id } });
      }
    }

    if (intake.pickupId) {
      const pickup = await transaction.pickup.findUnique({
        where: { id: intake.pickupId },
        include: { _count: { select: { repairs: true, deliveries: true } } },
      });
      if (pickup && !pickup._count.repairs && !pickup._count.deliveries) {
        await transaction.pickup.delete({ where: { id: pickup.id } });
      }
    }
  });

  revalidatePath("/");
  revalidatePath("/devices");
  revalidatePath(`/devices/${intake.assetId}`);
  revalidatePath("/deliveries");
  revalidatePath("/customers");
  if (intake.deliveryId) revalidatePath(`/deliveries/${intake.deliveryId}`);
  if (returnToDashboard) redirect(`/?repairRemoved=1${intake.pickupId ? `#${intake.pickupId}` : ""}`);
  redirect(`/devices/${intake.assetId}?repairRemoved=1`);
}

export async function createStandaloneDelivery(formData: FormData) {
  await requireAuthenticatedUser();
  const customerId = requiredString(formData, "customerId");
  await prisma.customer.findFirstOrThrow({ where: { id: customerId, removedAt: null } });
  const delivery = await prisma.$transaction((transaction) => createNumberedDelivery(transaction, { customerId }));

  revalidatePath("/deliveries");
  redirect(`/deliveries/${delivery.id}`);
}

export async function removeRepairFromDelivery(deliveryId: string, repairId: string) {
  await requireAuthenticatedUser();
  await prisma.delivery.findFirstOrThrow({ where: { id: deliveryId, status: DeliveryStatus.DRAFT } });
  await prisma.repairIntake.updateMany({
    where: { id: repairId, deliveryId },
    data: { deliveryId: null },
  });
  revalidatePath("/");
  revalidatePath(`/deliveries/${deliveryId}`);
}

export async function addRepairToDelivery(deliveryId: string, repairId: string) {
  await requireAuthenticatedUser();
  const delivery = await prisma.delivery.findFirstOrThrow({
    where: { id: deliveryId, status: DeliveryStatus.DRAFT },
    include: { pickup: { select: { customerId: true } } },
  });
  const customerId = delivery.customerId ?? delivery.pickup?.customerId;
  if (!customerId) throw new Error("Select a customer before adding a pickup device.");
  const repair = await prisma.repairIntake.findFirstOrThrow({
    where: { id: repairId, deliveryId: null, status: { notIn: closedRepairStatuses }, asset: { disposition: AssetDisposition.ACTIVE } },
    select: { asset: { select: { customerId: true } } },
  });
  if (repair.asset.customerId !== customerId) throw new Error("The device must belong to this delivery's customer.");
  await prisma.repairIntake.updateMany({
    where: { id: repairId, deliveryId: null, status: { notIn: closedRepairStatuses } },
    data: { deliveryId },
  });
  revalidatePath("/");
  revalidatePath(`/deliveries/${deliveryId}`);
}

export async function finalizeDelivery(deliveryId: string) {
  await requireAuthenticatedUser();
  const delivery = await prisma.delivery.findFirstOrThrow({
    where: { id: deliveryId, status: DeliveryStatus.DRAFT },
    include: { repairs: { select: { id: true } }, items: { select: { id: true } } },
  });
  if (!delivery.repairs.length && !delivery.items.length) throw new Error("Add at least one device before completing this delivery.");

  await prisma.$transaction([
    prisma.delivery.update({
      where: { id: deliveryId },
      data: { status: DeliveryStatus.DELIVERED, deliveredAt: new Date(), warrantyStart: delivery.items.length ? new Date() : undefined },
    }),
    prisma.repairIntake.updateMany({
      where: { deliveryId, asset: { disposition: AssetDisposition.ACTIVE } },
      data: { status: RepairStatus.DELIVERED },
    }),
  ]);

  revalidatePath("/");
  revalidatePath("/deliveries");
  revalidatePath("/work-orders");
  redirect(`/deliveries/${deliveryId}?completed=1`);
}

export async function reopenDelivery(deliveryId: string) {
  await requireAuthenticatedUser();
  await prisma.delivery.findFirstOrThrow({ where: { id: deliveryId, status: DeliveryStatus.DELIVERED } });
  await prisma.$transaction([
    prisma.delivery.update({
      where: { id: deliveryId },
      data: { status: DeliveryStatus.DRAFT, deliveredAt: null, warrantyStart: null },
    }),
    prisma.repairIntake.updateMany({
      where: { deliveryId, status: RepairStatus.DELIVERED, asset: { disposition: AssetDisposition.ACTIVE } },
      data: { status: RepairStatus.READY_FOR_DELIVERY },
    }),
    prisma.repairIntake.updateMany({
      where: { deliveryId, status: RepairStatus.DELIVERED, asset: { disposition: AssetDisposition.RECYCLED } },
      data: { status: RepairStatus.REMOVED },
    }),
  ]);

  revalidatePath("/");
  revalidatePath("/devices");
  revalidatePath("/deliveries");
  revalidatePath(`/deliveries/${deliveryId}`);
  redirect(`/deliveries/${deliveryId}?reopened=1`);
}

export async function disposeRepairDevice(intakeId: string, formData: FormData) {
  await requireAuthenticatedUser();
  const dispositionValue = requiredString(formData, "disposition");
  if (dispositionValue !== AssetDisposition.RECYCLED && dispositionValue !== AssetDisposition.REMOVED) {
    throw new Error("Invalid device disposition.");
  }
  const disposition = dispositionValue as AssetDisposition;
  const notes = String(formData.get("dispositionNotes") ?? "").trim() || null;
  const intake = await prisma.repairIntake.findFirstOrThrow({
    where: { id: intakeId, status: { notIn: closedRepairStatuses } },
    select: { assetId: true, status: true, pickupId: true, deliveryId: true, pickup: { select: { customerId: true } } },
  });

  const deliveryId = await prisma.$transaction(async (transaction) => {
    let targetDeliveryId = disposition === AssetDisposition.RECYCLED ? intake.deliveryId : null;
    if (disposition === AssetDisposition.RECYCLED && !targetDeliveryId && intake.pickupId && intake.pickup) {
      const existingDraft = await transaction.delivery.findFirst({
        where: { pickupId: intake.pickupId, status: DeliveryStatus.DRAFT },
        select: { id: true },
      });
      if (existingDraft) {
        targetDeliveryId = existingDraft.id;
      } else {
        const delivery = await createNumberedDelivery(transaction, {
          pickupId: intake.pickupId,
          customerId: intake.pickup.customerId,
        });
        targetDeliveryId = delivery.id;
      }
    }

    await transaction.asset.update({
      where: { id: intake.assetId },
      data: { disposition, disposedAt: new Date(), dispositionNotes: notes },
    });
    await transaction.repairIntake.update({
      where: { id: intakeId },
      data: { statusBeforeRemoval: intake.status, status: RepairStatus.REMOVED, deliveryId: targetDeliveryId },
    });
    return targetDeliveryId;
  });

  revalidatePath("/");
  revalidatePath("/customers");
  revalidatePath("/devices");
  revalidatePath("/deliveries");
  if (deliveryId) revalidatePath(`/deliveries/${deliveryId}`);
  revalidatePath(`/devices/${intake.assetId}`);
  revalidatePath(`/work-orders/${intakeId}`);
  redirect(`/work-orders/${intakeId}?disposed=${disposition.toLowerCase()}`);
}

export async function batchRemoveDevices(formData: FormData) {
  await requireAuthenticatedUser();
  const assetIds = formData.getAll("assetId").filter((value): value is string => typeof value === "string" && Boolean(value));
  if (!assetIds.length) throw new Error("Select at least one device to remove.");
  const assets = await prisma.asset.findMany({ where: { id: { in: assetIds }, disposition: AssetDisposition.ACTIVE }, select: { id: true } });
  if (!assets.length) throw new Error("No active devices were selected.");
  const validIds = assets.map((asset) => asset.id);
  const repairs = await prisma.repairIntake.findMany({
    where: { assetId: { in: validIds }, status: { notIn: closedRepairStatuses } },
    select: { id: true, status: true },
  });

  await prisma.$transaction(async (transaction) => {
    await transaction.asset.updateMany({
      where: { id: { in: validIds } },
      data: { disposition: AssetDisposition.REMOVED, disposedAt: new Date(), dispositionNotes: "Removed from the device directory" },
    });
    for (const status of editableRepairStatuses) {
      const repairIds = repairs.filter((repair) => repair.status === status).map((repair) => repair.id);
      if (repairIds.length) await transaction.repairIntake.updateMany({ where: { id: { in: repairIds } }, data: { statusBeforeRemoval: status as RepairStatus, status: RepairStatus.REMOVED, deliveryId: null } });
    }
  });

  revalidatePath("/");
  revalidatePath("/customers");
  revalidatePath("/devices");
}

export async function restoreDevice(assetId: string) {
  await requireAuthenticatedUser();
  const asset = await prisma.asset.findFirstOrThrow({
    where: { id: assetId, disposition: { not: AssetDisposition.ACTIVE } },
    include: { repairIntakes: { where: { status: RepairStatus.REMOVED }, orderBy: { pickedUpAt: "desc" }, take: 1 } },
  });
  const repair = asset.repairIntakes[0];
  await prisma.$transaction(async (transaction) => {
    await transaction.asset.update({ where: { id: assetId }, data: { disposition: AssetDisposition.ACTIVE, disposedAt: null, dispositionNotes: null } });
    if (repair) await transaction.repairIntake.update({
      where: { id: repair.id },
      data: { status: repair.statusBeforeRemoval ?? RepairStatus.IN_POSSESSION, statusBeforeRemoval: null },
    });
  });
  revalidatePath("/");
  revalidatePath("/customers");
  revalidatePath("/devices");
  revalidatePath(`/devices/${assetId}`);
  redirect(`/devices/${assetId}?restored=1`);
}

export async function permanentlyDeleteDevice(assetId: string) {
  await requireAuthenticatedUser();
  await prisma.asset.findFirstOrThrow({ where: { id: assetId, disposition: { not: AssetDisposition.ACTIVE } } });
  await prisma.$transaction([
    prisma.deliveryItem.deleteMany({ where: { assetId } }),
    prisma.asset.delete({ where: { id: assetId } }),
  ]);
  revalidatePath("/customers");
  revalidatePath("/devices");
  redirect("/devices?state=archived&deleted=1");
}

export async function removeCustomer(customerId: string) {
  await requireAuthenticatedUser();
  const openRepairs = await prisma.repairIntake.count({
    where: { asset: { customerId }, status: { notIn: closedRepairStatuses } },
  });
  if (openRepairs) throw new Error("Complete or remove this customer's open repairs before removing the customer.");
  await prisma.customer.update({ where: { id: customerId }, data: { removedAt: new Date() } });
  revalidatePath("/customers");
  revalidatePath("/devices");
  redirect("/customers?state=removed");
}

export async function restoreCustomer(customerId: string) {
  await requireAuthenticatedUser();
  await prisma.customer.update({ where: { id: customerId }, data: { removedAt: null } });
  revalidatePath("/customers");
  revalidatePath("/devices");
  redirect(`/customers/${customerId}?restored=1`);
}

export type AddSaleDeviceState = { error?: string; success?: string };

export async function addSaleDevice(deliveryId: string, _state: AddSaleDeviceState, formData: FormData): Promise<AddSaleDeviceState> {
  await requireAuthenticatedUser();
  const serialNumber = String(formData.get("serialNumber") ?? "").trim();
  const brand = String(formData.get("brand") ?? "").trim();
  const family = String(formData.get("family") ?? "").trim();
  const assetTag = String(formData.get("assetTag") ?? "").trim() || null;
  const locationId = String(formData.get("locationId") ?? "").trim() || null;
  if (!serialNumber || !brand || !family) return { error: "Brand, model, and serial number are required." };

  const delivery = await prisma.delivery.findFirstOrThrow({
    where: { id: deliveryId, status: DeliveryStatus.DRAFT },
    include: { pickup: { select: { customerId: true } } },
  });
  const customerId = delivery.customerId ?? delivery.pickup?.customerId;
  if (!customerId) return { error: "A customer is required before adding a new device." };
  if (locationId) {
    const location = await prisma.location.findFirst({ where: { id: locationId, customerId }, select: { id: true } });
    if (!location) return { error: "The selected location does not belong to this customer." };
  }

  const existing = await prisma.asset.findFirst({
    where: { OR: [{ serialNumber }, ...(assetTag ? [{ assetTag }] : [])] },
    select: { serialNumber: true, assetTag: true },
  });
  if (existing?.serialNumber === serialNumber) return { error: `Serial number ${serialNumber} is already assigned to a known device.` };
  if (assetTag && existing?.assetTag === assetTag) return { error: `Asset tag ${assetTag} is already assigned to another device.` };

  try {
    await prisma.$transaction(async (transaction) => {
      const asset = await transaction.asset.create({
        data: { serialNumber, assetTag, brand, family, rawModel: `${brand} ${family}`, customerId, locationId },
      });
      await transaction.deliveryItem.create({
        data: { deliveryId, assetId: asset.id, itemType: "OUTRIGHT_SALE" },
      });
    });
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "P2002") {
      return { error: "That serial number or asset tag was assigned by another request. Use a unique identifier." };
    }
    throw error;
  }

  revalidatePath("/devices");
  revalidatePath(`/deliveries/${deliveryId}`);
  return { success: `${brand} ${family} added to this delivery.` };
}

export async function removeSaleDevice(deliveryId: string, itemId: string) {
  await requireAuthenticatedUser();
  await prisma.delivery.findFirstOrThrow({ where: { id: deliveryId, status: DeliveryStatus.DRAFT } });
  const item = await prisma.deliveryItem.findFirst({ where: { id: itemId, deliveryId }, select: { assetId: true } });
  if (!item) return;
  await prisma.$transaction(async (transaction) => {
    await transaction.deliveryItem.delete({ where: { id: itemId } });
    await transaction.asset.deleteMany({
      where: { id: item.assetId, repairIntakes: { none: {} }, deliveries: { none: {} } },
    });
  });
  revalidatePath("/devices");
  revalidatePath(`/deliveries/${deliveryId}`);
}

export async function deleteDraftDelivery(deliveryId: string) {
  await requireAuthenticatedUser();
  const delivery = await prisma.delivery.findFirstOrThrow({
    where: { id: deliveryId, status: DeliveryStatus.DRAFT },
    include: { items: { select: { assetId: true } } },
  });
  const newAssetIds = delivery.items.map((item) => item.assetId);

  await prisma.$transaction(async (transaction) => {
    await transaction.delivery.delete({ where: { id: deliveryId } });
    if (newAssetIds.length) {
      await transaction.asset.deleteMany({
        where: { id: { in: newAssetIds }, repairIntakes: { none: {} }, deliveries: { none: {} } },
      });
    }
  });

  revalidatePath("/");
  revalidatePath("/devices");
  revalidatePath("/deliveries");
  redirect("/deliveries?deleted=1");
}

export async function updateDeviceNotes(assetId: string, formData: FormData) {
  await requireAuthenticatedUser();
  const notes = String(formData.get("notes") ?? "").trim();
  if (notes.length > 10_000) throw new Error("Device notes must be 10,000 characters or fewer.");
  await prisma.asset.update({ where: { id: assetId }, data: { notes: notes || null } });
  revalidatePath(`/devices/${assetId}`);
}

export async function updateDeliveryNotes(deliveryId: string, formData: FormData) {
  await requireAuthenticatedUser();
  const notes = String(formData.get("notes") ?? "").trim();
  if (notes.length > 10_000) throw new Error("Delivery notes must be 10,000 characters or fewer.");
  await prisma.delivery.update({ where: { id: deliveryId }, data: { notes: notes || null } });
  revalidatePath(`/deliveries/${deliveryId}`);
}
