-- Preserve any legacy free-text suggested action in resolution notes before
-- replacing it with structured, searchable resolution data.
-- CreateTable
CREATE TABLE "RepairResolutionItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "repairIntakeId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    CONSTRAINT "RepairResolutionItem_repairIntakeId_fkey" FOREIGN KEY ("repairIntakeId") REFERENCES "RepairIntake" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

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
    "resolutionType" TEXT,
    "resolutionNotes" TEXT,
    "deliveryId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RepairIntake_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RepairIntake_pickupId_fkey" FOREIGN KEY ("pickupId") REFERENCES "Pickup" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RepairIntake_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "Delivery" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_RepairIntake" ("actualIssue", "assetId", "createdAt", "deliveryId", "dueAt", "id", "intakeNumber", "pickedUpAt", "pickupId", "reportedIssue", "resolutionNotes", "status", "statusBeforeRemoval", "technician", "updatedAt")
SELECT "actualIssue", "assetId", "createdAt", "deliveryId", "dueAt", "id", "intakeNumber", "pickedUpAt", "pickupId", "reportedIssue",
  CASE
    WHEN "suggestedAction" IS NULL OR trim("suggestedAction") = '' THEN "resolutionNotes"
    WHEN "resolutionNotes" IS NULL OR trim("resolutionNotes") = '' THEN 'Legacy suggested action: ' || "suggestedAction"
    ELSE "resolutionNotes" || char(10) || 'Legacy suggested action: ' || "suggestedAction"
  END,
  "status", "statusBeforeRemoval", "technician", "updatedAt"
FROM "RepairIntake";
DROP TABLE "RepairIntake";
ALTER TABLE "new_RepairIntake" RENAME TO "RepairIntake";
CREATE INDEX "RepairIntake_status_idx" ON "RepairIntake"("status");
CREATE INDEX "RepairIntake_intakeNumber_idx" ON "RepairIntake"("intakeNumber");
CREATE INDEX "RepairIntake_assetId_idx" ON "RepairIntake"("assetId");
CREATE INDEX "RepairIntake_pickupId_idx" ON "RepairIntake"("pickupId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "RepairResolutionItem_value_idx" ON "RepairResolutionItem"("value");

-- CreateIndex
CREATE UNIQUE INDEX "RepairResolutionItem_repairIntakeId_value_key" ON "RepairResolutionItem"("repairIntakeId", "value");
