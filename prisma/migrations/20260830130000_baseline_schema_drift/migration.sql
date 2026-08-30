-- Baseline for schema drift.
--
-- These models and columns were applied to the live database with `prisma db
-- push` and never captured as migrations, so `migrate deploy` on a fresh
-- database produced a schema the application could not run against. This
-- migration is the accumulated difference and is purely additive.
--
-- Already present on the existing database; marked applied there with
-- `prisma migrate resolve --applied`.

-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('BONUS', 'EZAM_ELAVE', 'AVANS', 'OVERTIME');

-- CreateEnum
CREATE TYPE "ExpenseType" AS ENUM ('FOOD', 'TOOL', 'OTHER');

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'SUPERVISOR';

-- AlterTable
ALTER TABLE "AttendanceRecord" ADD COLUMN     "cookedPaid" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "expenseAmount" DOUBLE PRECISION,
ADD COLUMN     "expenseType" "ExpenseType",
ADD COLUMN     "fineAmount" DOUBLE PRECISION,
ADD COLUMN     "paymentAmount" DOUBLE PRECISION,
ADD COLUMN     "paymentPaid" DOUBLE PRECISION,
ADD COLUMN     "paymentType" "PaymentType",
ADD COLUMN     "workerName" TEXT;

-- AlterTable
ALTER TABLE "Car" ADD COLUMN     "fuelCardNumber" TEXT,
ADD COLUMN     "fuelOnly" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "isTemporary" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sickLimit" INTEGER,
ADD COLUMN     "vacationLimit" INTEGER;

-- CreateTable
CREATE TABLE "CustomField" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "carId" INTEGER,
    "employeeId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimetype" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "storedName" TEXT NOT NULL,
    "carId" INTEGER,
    "employeeId" INTEGER,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FuelTransaction" (
    "id" TEXT NOT NULL,
    "transactionTime" TIMESTAMP(3) NOT NULL,
    "cardHolderName" TEXT,
    "cardNumber" TEXT,
    "productName" TEXT,
    "productQuantity" DOUBLE PRECISION,
    "productMeasure" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "stationName" TEXT,
    "plate" TEXT NOT NULL,
    "carId" INTEGER,
    "isRefund" BOOLEAN NOT NULL DEFAULT false,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FuelTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "FormResponse" (
    "id" SERIAL NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "employeeName" TEXT NOT NULL,
    "activityText" TEXT,
    "absenceReason" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL,
    "date" DATE NOT NULL,
    "raw" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FormResponse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CustomField_carId_idx" ON "CustomField"("carId");

-- CreateIndex
CREATE INDEX "CustomField_employeeId_idx" ON "CustomField"("employeeId");

-- CreateIndex
CREATE INDEX "Document_carId_idx" ON "Document"("carId");

-- CreateIndex
CREATE INDEX "Document_employeeId_idx" ON "Document"("employeeId");

-- CreateIndex
CREATE INDEX "FuelTransaction_carId_idx" ON "FuelTransaction"("carId");

-- CreateIndex
CREATE INDEX "FuelTransaction_transactionTime_idx" ON "FuelTransaction"("transactionTime");

-- CreateIndex
CREATE INDEX "FuelTransaction_plate_idx" ON "FuelTransaction"("plate");

-- CreateIndex
CREATE INDEX "FormResponse_employeeId_date_idx" ON "FormResponse"("employeeId", "date");

-- CreateIndex
CREATE INDEX "FormResponse_submittedAt_idx" ON "FormResponse"("submittedAt");

-- AddForeignKey
ALTER TABLE "CustomField" ADD CONSTRAINT "CustomField_carId_fkey" FOREIGN KEY ("carId") REFERENCES "Car"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomField" ADD CONSTRAINT "CustomField_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_carId_fkey" FOREIGN KEY ("carId") REFERENCES "Car"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FuelTransaction" ADD CONSTRAINT "FuelTransaction_carId_fkey" FOREIGN KEY ("carId") REFERENCES "Car"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormResponse" ADD CONSTRAINT "FormResponse_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

