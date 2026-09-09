import { readFile } from "node:fs/promises";
import path from "node:path";
import { importNinjaDevices } from "../src/lib/import-ninja-devices";
import { parseCsv } from "../src/lib/csv";
import { prisma } from "../src/lib/prisma";

async function main() {
  const csvPath = path.resolve(process.cwd(), "Devices.csv");
  const csvText = await readFile(csvPath, "utf8");
  if (!parseCsv(csvText).length) throw new Error("Devices.csv does not contain any device rows.");

  await prisma.$transaction(async (transaction) => {
    await transaction.deliveryItem.deleteMany();
    await transaction.repairIntake.deleteMany();
    await transaction.delivery.deleteMany();
    await transaction.pickup.deleteMany();
    await transaction.asset.deleteMany();
    await transaction.location.deleteMany();
    await transaction.customer.deleteMany();
    await transaction.partner.deleteMany();
    await transaction.customer.create({ data: { id: "cust_cicero", name: "Cicero Therapies" } });
  });

  const result = await importNinjaDevices(csvText, "cust_cicero");
  console.log(`Imported ${result.imported} Cicero devices from ${result.totalRows} CSV rows.`);
  console.log(`${result.locationsCreated} locations created; ${result.duplicateRows} duplicate serial rows consolidated; ${result.skipped} rows skipped.`);
  if (result.errors.length) console.log(result.errors.join("\n"));
}

main().finally(() => prisma.$disconnect());
