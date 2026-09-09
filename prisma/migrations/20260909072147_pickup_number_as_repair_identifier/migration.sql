-- DropIndex
DROP INDEX "RepairIntake_intakeNumber_key";

-- CreateIndex
CREATE INDEX "RepairIntake_intakeNumber_idx" ON "RepairIntake"("intakeNumber");
