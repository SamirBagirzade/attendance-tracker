CREATE TYPE "CarMaintenanceType" AS ENUM ('OIL_CHANGE', 'INSURANCE', 'INSPECTION');

CREATE TABLE "CarMaintenanceRecord" (
    "id" SERIAL NOT NULL,
    "carId" INTEGER NOT NULL,
    "type" "CarMaintenanceType" NOT NULL,
    "date" DATE NOT NULL,
    "km" INTEGER,
    "oilBrand" TEXT,
    "oilQuantity" DOUBLE PRECISION,
    "company" TEXT,
    "cost" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CarMaintenanceRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CarMaintenanceRecord_carId_type_date_key" ON "CarMaintenanceRecord"("carId", "type", "date");
CREATE INDEX "CarMaintenanceRecord_carId_idx" ON "CarMaintenanceRecord"("carId");
CREATE INDEX "CarMaintenanceRecord_type_idx" ON "CarMaintenanceRecord"("type");
CREATE INDEX "CarMaintenanceRecord_date_idx" ON "CarMaintenanceRecord"("date");

ALTER TABLE "CarMaintenanceRecord" ADD CONSTRAINT "CarMaintenanceRecord_carId_fkey"
    FOREIGN KEY ("carId") REFERENCES "Car"("id") ON DELETE CASCADE ON UPDATE CASCADE;
