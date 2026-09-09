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
    "customerId" TEXT,
    "warrantyStart" DATETIME,
    "warrantyDays" INTEGER NOT NULL DEFAULT 90,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Delivery_pickupId_fkey" FOREIGN KEY ("pickupId") REFERENCES "Pickup" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Delivery_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Delivery" ("createdAt", "deliveredAt", "deliveryNumber", "id", "notes", "pickupId", "recipientName", "status", "updatedAt", "warrantyDays", "warrantyStart") SELECT "createdAt", "deliveredAt", "deliveryNumber", "id", "notes", "pickupId", "recipientName", "status", "updatedAt", "warrantyDays", "warrantyStart" FROM "Delivery";
DROP TABLE "Delivery";
ALTER TABLE "new_Delivery" RENAME TO "Delivery";
CREATE UNIQUE INDEX "Delivery_deliveryNumber_key" ON "Delivery"("deliveryNumber");
CREATE INDEX "Delivery_pickupId_idx" ON "Delivery"("pickupId");
CREATE INDEX "Delivery_customerId_idx" ON "Delivery"("customerId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
