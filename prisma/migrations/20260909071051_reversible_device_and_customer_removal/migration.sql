-- AlterTable
ALTER TABLE "Customer" ADD COLUMN "removedAt" DATETIME;

-- AlterTable
ALTER TABLE "RepairIntake" ADD COLUMN "statusBeforeRemoval" TEXT;
