-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AttendanceStatus" ADD VALUE 'BAYRAM';
ALTER TYPE "AttendanceStatus" ADD VALUE 'ICAZELI';
ALTER TYPE "AttendanceStatus" ADD VALUE 'ISTIRAHET';
ALTER TYPE "AttendanceStatus" ADD VALUE 'ISDE_DEYIL';

-- CreateTable
CREATE TABLE "AttendanceWorkLocation" (
    "id" SERIAL NOT NULL,
    "attendanceRecordId" INTEGER NOT NULL,
    "locationId" INTEGER NOT NULL,

    CONSTRAINT "AttendanceWorkLocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AttendanceWorkLocation_locationId_idx" ON "AttendanceWorkLocation"("locationId");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceWorkLocation_attendanceRecordId_locationId_key" ON "AttendanceWorkLocation"("attendanceRecordId", "locationId");

-- AddForeignKey
ALTER TABLE "AttendanceWorkLocation" ADD CONSTRAINT "AttendanceWorkLocation_attendanceRecordId_fkey" FOREIGN KEY ("attendanceRecordId") REFERENCES "AttendanceRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceWorkLocation" ADD CONSTRAINT "AttendanceWorkLocation_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;
