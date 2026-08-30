import { prisma } from "@/lib/prisma";
import { getUnitOdometers } from "@/lib/wialon-client";
import { normalizePlate } from "@/lib/azpetrol-sync";
import { withSyncLock, writeSyncTimestamp } from "@/lib/sync-lock";

export const ODOMETER_SYNC_LOCK = "odometer_sync_lock";
export const ODOMETER_SYNC_LAST_RUN = "odometer_sync_last_run";

// How far an odometer may fall before the reading is treated as a broken sensor
// rather than a correction to a manual estimate.
//
// This guard is doing real work: one unit in this account has a sensor typed
// "mileage" and labelled "км" that is actually wired to the supply voltage, so
// it reports ~12,836 where the vehicle has 237,000 on the clock. The sensor
// metadata is indistinguishable from a genuine one — only the parameter differs
// — so the reading has to be judged on plausibility instead. Guarding this way
// rather than whitelisting a tracker's parameter number also means a sensor that
// starts misreporting later is caught without a code change.
const MAX_DECREASE_KM = 5_000;

export type OdometerOutcome =
  | { plate: string; status: "seeded"; km: number }
  | { plate: string; status: "updated"; km: number; previousKm: number }
  | { plate: string; status: "corrected"; km: number; previousKm: number }
  | { plate: string; status: "unchanged"; km: number }
  | { plate: string; status: "implausible"; km: number; previousKm: number }
  | { plate: string; status: "noCarForUnit" };

export type OdometerSyncResult = {
  unitsRead: number;
  updated: number;
  outcomes: OdometerOutcome[];
  skippedUnits: Array<{ unitName: string; reason: string }>;
  carsWithoutUnit: string[];
};

export async function syncOdometers(): Promise<OdometerSyncResult> {
  return withSyncLock(ODOMETER_SYNC_LOCK, "odometer sync", runOdometerSync);
}

async function runOdometerSync(): Promise<OdometerSyncResult> {
  const { readings, skipped } = await getUnitOdometers();

  const cars = await prisma.car.findMany({ select: { id: true, licensePlate: true, currentKm: true } });
  // Exact match on the normalised plate only. The telemetry page's
  // findUnitForPlate falls back to a substring match, which would happily pair
  // 10AA100 with a unit named 10AA1001 — tolerable when a human is looking at
  // one report, not when it writes an odometer to the wrong vehicle.
  const carByPlate = new Map(cars.map((car) => [normalizePlate(car.licensePlate), car]));

  const outcomes: OdometerOutcome[] = [];
  const matchedCarIds = new Set<number>();
  let updated = 0;

  for (const reading of readings) {
    const plate = normalizePlate(reading.plateToken);
    const car = carByPlate.get(plate);

    if (!car) {
      outcomes.push({ plate: reading.plateToken, status: "noCarForUnit" });
      continue;
    }

    matchedCarIds.add(car.id);

    const previousKm = car.currentKm;

    if (previousKm === null) {
      await prisma.car.update({ where: { id: car.id }, data: { currentKm: reading.km } });
      outcomes.push({ plate: car.licensePlate, status: "seeded", km: reading.km });
      updated++;
      continue;
    }

    if (reading.km === previousKm) {
      outcomes.push({ plate: car.licensePlate, status: "unchanged", km: reading.km });
      continue;
    }

    const decrease = previousKm - reading.km;

    if (decrease > MAX_DECREASE_KM) {
      console.error(
        `[odometer-sync] ${car.licensePlate}: refusing ${reading.km} km, ${decrease} km below the stored ${previousKm}. Check the unit's mileage sensor.`,
      );
      outcomes.push({ plate: car.licensePlate, status: "implausible", km: reading.km, previousKm });
      continue;
    }

    await prisma.car.update({ where: { id: car.id }, data: { currentKm: reading.km } });
    updated++;

    if (decrease > 0) {
      // Applied, but worth seeing: the stored figure was probably a manual
      // estimate, though it can also be the first sign of a failing sensor.
      console.warn(`[odometer-sync] ${car.licensePlate}: ${previousKm} km -> ${reading.km} km (down ${decrease}).`);
      outcomes.push({ plate: car.licensePlate, status: "corrected", km: reading.km, previousKm });
    } else {
      outcomes.push({ plate: car.licensePlate, status: "updated", km: reading.km, previousKm });
    }
  }

  await writeSyncTimestamp(ODOMETER_SYNC_LAST_RUN, new Date());

  return {
    unitsRead: readings.length,
    updated,
    outcomes,
    skippedUnits: skipped.map((s) => ({ unitName: s.unitName, reason: s.reason })),
    carsWithoutUnit: cars.filter((car) => !matchedCarIds.has(car.id)).map((car) => car.licensePlate),
  };
}
