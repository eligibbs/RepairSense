import { parseCsv } from "@/lib/csv";
import { normalizeNinjaDevice } from "@/lib/normalizeDevice";
import { prisma } from "@/lib/prisma";

export interface DeviceImportResult {
  totalRows: number;
  imported: number;
  created: number;
  updated: number;
  duplicateRows: number;
  skipped: number;
  locationsCreated: number;
  errors: string[];
}

const requiredHeaders = ["Id", "Organization", "Device Make", "Serial Number", "Device Model"];
const knownLocationCodes: Record<string, string> = {
  "Child's Play": "CP",
  Clubhouse: "CH",
  "Internal Infrastructure": "II",
  "K1ds Count Therapy": "KCT",
  "K1ds Count Therapy AppleID": "KCT-AID",
  "Kids Count Therapy School": "KCTS",
  "Kids Speak": "KS",
  MTS: "MTS",
  Phones: "PHONES",
  SLC: "SLC",
  TLC: "TLC",
  "Time Clock": "CLOCK",
};

function baseLocationCode(name: string) {
  const known = knownLocationCodes[name];
  if (known) return known;
  const initials = name.split(/[^A-Za-z0-9]+/).filter(Boolean).map((part) => part[0]).join("").toUpperCase();
  return (initials || name.replace(/[^A-Za-z0-9]/g, "").toUpperCase() || "LOC").slice(0, 12);
}

export async function importNinjaDevices(csvText: string, customerId: string): Promise<DeviceImportResult> {
  const rows = parseCsv(csvText);
  if (!rows.length) throw new Error("The CSV does not contain any device rows.");
  const missingHeaders = requiredHeaders.filter((header) => !(header in rows[0]));
  if (missingHeaders.length) throw new Error(`Missing required columns: ${missingHeaders.join(", ")}.`);
  await prisma.customer.findFirstOrThrow({ where: { id: customerId, removedAt: null } });

  const uniqueBySerial = new Map<string, Record<string, string>>();
  let blankRows = 0;
  for (const row of rows) {
    const serial = row["Serial Number"].trim();
    if (!serial) {
      blankRows += 1;
      continue;
    }
    uniqueBySerial.set(serial, row);
  }
  const deviceRows = [...uniqueBySerial.values()];
  const locationNames = [...new Set(deviceRows.map((row) => row.Organization.trim()).filter(Boolean))];
  const existingLocations = await prisma.location.findMany({ where: { customerId }, select: { id: true, code: true, name: true } });
  const locationsByName = new Map(existingLocations.map((location) => [location.name, location]));
  const usedCodes = new Set(existingLocations.map((location) => location.code));
  let locationsCreated = 0;

  for (const name of locationNames) {
    if (locationsByName.has(name)) continue;
    const base = baseLocationCode(name);
    let code = base;
    let suffix = 2;
    while (usedCodes.has(code)) {
      code = `${base.slice(0, Math.max(1, 12 - String(suffix).length - 1))}-${suffix}`;
      suffix += 1;
    }
    const location = await prisma.location.create({ data: { customerId, code, name }, select: { id: true, code: true, name: true } });
    locationsByName.set(name, location);
    usedCodes.add(code);
    locationsCreated += 1;
  }

  const existingSerials = new Set((await prisma.asset.findMany({ where: { serialNumber: { in: deviceRows.map((row) => row["Serial Number"].trim()) } }, select: { serialNumber: true } })).map((asset) => asset.serialNumber));
  let created = 0;
  let updated = 0;
  let skipped = blankRows;
  const errors: string[] = [];

  for (const row of deviceRows) {
    const serialNumber = row["Serial Number"].trim();
    const assetTag = row.Id.trim();
    const rawModel = row["Device Model"].trim();
    const specs = normalizeNinjaDevice({
      deviceMake: row["Device Make"],
      deviceModel: rawModel,
      processorsName: row["Processors Name"],
      osName: row["OS Name"],
    });
    const locationId = locationsByName.get(row.Organization.trim())?.id ?? null;
    const ninjaId = Number.parseInt(assetTag, 10);
    try {
      await prisma.asset.upsert({
        where: { serialNumber },
        create: {
          serialNumber,
          assetTag,
          ninjaId: Number.isFinite(ninjaId) ? ninjaId : null,
          brand: specs.brand,
          family: specs.family,
          modelYear: specs.modelYear,
          chipset: specs.chipset,
          rawModel,
          customerId,
          locationId,
        },
        update: {
          assetTag,
          ninjaId: Number.isFinite(ninjaId) ? ninjaId : null,
          brand: specs.brand,
          family: specs.family,
          modelYear: specs.modelYear,
          chipset: specs.chipset,
          rawModel,
          customerId,
          locationId,
          disposition: "ACTIVE",
          disposedAt: null,
          dispositionNotes: null,
        },
      });
      if (existingSerials.has(serialNumber)) updated += 1;
      else created += 1;
    } catch {
      skipped += 1;
      if (errors.length < 10) errors.push(`${serialNumber}: serial, Ninja ID, or asset tag conflicts with another device.`);
    }
  }

  return {
    totalRows: rows.length,
    imported: created + updated,
    created,
    updated,
    duplicateRows: rows.length - blankRows - deviceRows.length,
    skipped,
    locationsCreated,
    errors,
  };
}
