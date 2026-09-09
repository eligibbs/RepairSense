-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Asset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "serialNumber" TEXT NOT NULL,
    "assetTag" TEXT,
    "ninjaId" INTEGER,
    "brand" TEXT NOT NULL,
    "family" TEXT,
    "modelYear" INTEGER,
    "chipset" TEXT,
    "rawModel" TEXT,
    "locationId" TEXT,
    "customerId" TEXT NOT NULL,
    "disposition" TEXT NOT NULL DEFAULT 'ACTIVE',
    "disposedAt" DATETIME,
    "dispositionNotes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Asset_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Asset_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Asset" ("assetTag", "brand", "chipset", "createdAt", "customerId", "family", "id", "locationId", "modelYear", "ninjaId", "rawModel", "serialNumber", "updatedAt") SELECT "assetTag", "brand", "chipset", "createdAt", "customerId", "family", "id", "locationId", "modelYear", "ninjaId", "rawModel", "serialNumber", "updatedAt" FROM "Asset";
DROP TABLE "Asset";
ALTER TABLE "new_Asset" RENAME TO "Asset";
CREATE UNIQUE INDEX "Asset_serialNumber_key" ON "Asset"("serialNumber");
CREATE UNIQUE INDEX "Asset_assetTag_key" ON "Asset"("assetTag");
CREATE UNIQUE INDEX "Asset_ninjaId_key" ON "Asset"("ninjaId");
CREATE INDEX "Asset_serialNumber_idx" ON "Asset"("serialNumber");
CREATE INDEX "Asset_assetTag_idx" ON "Asset"("assetTag");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
