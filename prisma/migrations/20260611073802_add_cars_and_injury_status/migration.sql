-- AlterEnum
ALTER TYPE "AttendanceStatus" ADD VALUE 'ISDE_XESARET';

-- AlterTable
ALTER TABLE "AttendanceRecord" ADD COLUMN     "carDriven" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "carId" INTEGER,
ADD COLUMN     "note" TEXT;

-- CreateTable
CREATE TABLE "Car" (
    "id" SERIAL NOT NULL,
    "makeModel" TEXT NOT NULL,
    "licensePlate" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Car_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Car_licensePlate_key" ON "Car"("licensePlate");

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_carId_fkey" FOREIGN KEY ("carId") REFERENCES "Car"("id") ON DELETE SET NULL ON UPDATE CASCADE;
