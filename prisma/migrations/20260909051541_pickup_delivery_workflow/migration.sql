/*
  Warnings:

  - Added the required column `updatedAt` to the `Delivery` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "Pickup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pickupNumber" TEXT NOT NULL,
    "pickedUpAt" DATETIME NOT NULL,
    "notes" TEXT,
    "customerId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Pickup_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Delivery" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "deliveryNumber" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "deliveredAt" DATETIME,
    "recipientName" TEXT,
    "notes" TEXT,
    "pickupId" TEXT,
    "warrantyStart" DATETIME,
    "warrantyDays" INTEGER NOT NULL DEFAULT 90,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Delivery_pickupId_fkey" FOREIGN KEY ("pickupId") REFERENCES "Pickup" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Delivery" ("deliveredAt", "deliveryNumber", "id", "notes", "recipientName", "warrantyDays", "warrantyStart") SELECT "deliveredAt", "deliveryNumber", "id", "notes", "recipientName", "warrantyDays", "warrantyStart" FROM "Delivery";
DROP TABLE "Delivery";
ALTER TABLE "new_Delivery" RENAME TO "Delivery";
CREATE UNIQUE INDEX "Delivery_deliveryNumber_key" ON "Delivery"("deliveryNumber");
CREATE INDEX "Delivery_pickupId_idx" ON "Delivery"("pickupId");
CREATE TABLE "new_RepairIntake" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "intakeNumber" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "pickedUpAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'IN_POSSESSION',
    "technician" TEXT,
    "pickupId" TEXT,
    "reportedIssue" TEXT NOT NULL,
    "actualIssue" TEXT,
    "suggestedAction" TEXT,
    "resolutionNotes" TEXT,
    "deliveryId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RepairIntake_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RepairIntake_pickupId_fkey" FOREIGN KEY ("pickupId") REFERENCES "Pickup" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RepairIntake_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "Delivery" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_RepairIntake" ("actualIssue", "assetId", "createdAt", "deliveryId", "dueAt", "id", "intakeNumber", "pickedUpAt", "reportedIssue", "resolutionNotes", "status", "suggestedAction", "technician", "updatedAt") SELECT "actualIssue", "assetId", "createdAt", "deliveryId", "dueAt", "id", "intakeNumber", "pickedUpAt", "reportedIssue", "resolutionNotes", "status", "suggestedAction", "technician", "updatedAt" FROM "RepairIntake";
DROP TABLE "RepairIntake";
ALTER TABLE "new_RepairIntake" RENAME TO "RepairIntake";
CREATE UNIQUE INDEX "RepairIntake_intakeNumber_key" ON "RepairIntake"("intakeNumber");
CREATE INDEX "RepairIntake_status_idx" ON "RepairIntake"("status");
CREATE INDEX "RepairIntake_assetId_idx" ON "RepairIntake"("assetId");
CREATE INDEX "RepairIntake_pickupId_idx" ON "RepairIntake"("pickupId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Pickup_pickupNumber_key" ON "Pickup"("pickupNumber");

-- CreateIndex
CREATE INDEX "Pickup_customerId_idx" ON "Pickup"("customerId");

-- CreateIndex
CREATE INDEX "Pickup_pickedUpAt_idx" ON "Pickup"("pickedUpAt");
