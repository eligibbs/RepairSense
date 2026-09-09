-- Convert the previous single resolution category and its selected details into
-- independent actions so one repair can contain actions from several categories.
-- CreateTable
CREATE TABLE "RepairResolutionAction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "repairIntakeId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "item" TEXT,
    CONSTRAINT "RepairResolutionAction_repairIntakeId_fkey" FOREIGN KEY ("repairIntakeId") REFERENCES "RepairIntake" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "RepairResolutionAction" ("id", "repairIntakeId", "type", "item")
SELECT "RepairResolutionItem"."id", "RepairResolutionItem"."repairIntakeId", "RepairIntake"."resolutionType", "RepairResolutionItem"."value"
FROM "RepairResolutionItem"
JOIN "RepairIntake" ON "RepairIntake"."id" = "RepairResolutionItem"."repairIntakeId"
WHERE "RepairIntake"."resolutionType" IS NOT NULL;

INSERT INTO "RepairResolutionAction" ("id", "repairIntakeId", "type", "item")
SELECT "RepairIntake"."id" || '-resolution', "RepairIntake"."id", "RepairIntake"."resolutionType", NULL
FROM "RepairIntake"
WHERE "RepairIntake"."resolutionType" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "RepairResolutionItem"
    WHERE "RepairResolutionItem"."repairIntakeId" = "RepairIntake"."id"
  );

-- DropIndex
DROP INDEX "RepairResolutionItem_repairIntakeId_value_key";

-- DropIndex
DROP INDEX "RepairResolutionItem_value_idx";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "RepairResolutionItem";
PRAGMA foreign_keys=on;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_RepairIntake" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "intakeNumber" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "pickedUpAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'IN_POSSESSION',
    "statusBeforeRemoval" TEXT,
    "technician" TEXT,
    "pickupId" TEXT,
    "reportedIssue" TEXT NOT NULL,
    "actualIssue" TEXT,
    "resolutionNotes" TEXT,
    "deliveryId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RepairIntake_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RepairIntake_pickupId_fkey" FOREIGN KEY ("pickupId") REFERENCES "Pickup" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RepairIntake_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "Delivery" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_RepairIntake" ("actualIssue", "assetId", "createdAt", "deliveryId", "dueAt", "id", "intakeNumber", "pickedUpAt", "pickupId", "reportedIssue", "resolutionNotes", "status", "statusBeforeRemoval", "technician", "updatedAt") SELECT "actualIssue", "assetId", "createdAt", "deliveryId", "dueAt", "id", "intakeNumber", "pickedUpAt", "pickupId", "reportedIssue", "resolutionNotes", "status", "statusBeforeRemoval", "technician", "updatedAt" FROM "RepairIntake";
DROP TABLE "RepairIntake";
ALTER TABLE "new_RepairIntake" RENAME TO "RepairIntake";
CREATE INDEX "RepairIntake_status_idx" ON "RepairIntake"("status");
CREATE INDEX "RepairIntake_intakeNumber_idx" ON "RepairIntake"("intakeNumber");
CREATE INDEX "RepairIntake_assetId_idx" ON "RepairIntake"("assetId");
CREATE INDEX "RepairIntake_pickupId_idx" ON "RepairIntake"("pickupId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "RepairResolutionAction_type_idx" ON "RepairResolutionAction"("type");

-- CreateIndex
CREATE INDEX "RepairResolutionAction_item_idx" ON "RepairResolutionAction"("item");

-- CreateIndex
CREATE INDEX "RepairResolutionAction_repairIntakeId_idx" ON "RepairResolutionAction"("repairIntakeId");
