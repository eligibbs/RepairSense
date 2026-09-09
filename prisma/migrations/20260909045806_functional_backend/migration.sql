/*
  Warnings:

  - Added the required column `intakeNumber` to the `RepairIntake` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "Part" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "onHand" INTEGER NOT NULL DEFAULT 0,
    "minOnHand" INTEGER NOT NULL DEFAULT 0,
    "costCents" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
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
    "technician" TEXT,
    "reportedIssue" TEXT NOT NULL,
    "actualIssue" TEXT,
    "suggestedAction" TEXT,
    "resolutionNotes" TEXT,
    "deliveryId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RepairIntake_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RepairIntake_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "Delivery" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_RepairIntake" ("actualIssue", "assetId", "createdAt", "deliveryId", "id", "pickedUpAt", "reportedIssue", "resolutionNotes", "status", "suggestedAction", "updatedAt") SELECT "actualIssue", "assetId", "createdAt", "deliveryId", "id", "pickedUpAt", "reportedIssue", "resolutionNotes", "status", "suggestedAction", "updatedAt" FROM "RepairIntake";
DROP TABLE "RepairIntake";
ALTER TABLE "new_RepairIntake" RENAME TO "RepairIntake";
CREATE UNIQUE INDEX "RepairIntake_intakeNumber_key" ON "RepairIntake"("intakeNumber");
CREATE INDEX "RepairIntake_status_idx" ON "RepairIntake"("status");
CREATE INDEX "RepairIntake_assetId_idx" ON "RepairIntake"("assetId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Part_sku_key" ON "Part"("sku");

-- CreateIndex
CREATE INDEX "Part_name_idx" ON "Part"("name");
