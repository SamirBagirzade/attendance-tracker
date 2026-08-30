export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  try {
    const { prisma } = await import("./lib/prisma");
    const { syncFuelTransactions } = await import("./lib/azpetrol-sync");
    const { syncOdometers, ODOMETER_SYNC_LAST_RUN } = await import("./lib/wialon-odometer-sync");
    const { readSyncTimestamp } = await import("./lib/sync-lock");

    const agg = await prisma.fuelTransaction.aggregate({ _max: { transactionTime: true } });
    const lastSync = agg._max.transactionTime;
    const staleMs = 12 * 60 * 60 * 1000; // 12 hours

    if (!lastSync || Date.now() - lastSync.getTime() > staleMs) {
      console.log("[fuel-sync] Auto-syncing on startup (last sync:", lastSync?.toISOString() ?? "never", ")");
      syncFuelTransactions()
        .then((r) => {
          if (r.partial) {
            console.error("[fuel-sync] PARTIAL — chunks failed, data has gaps:", r.failedChunks);
          }
          console.log("[fuel-sync] Done:", r);
        })
        .catch((e) => {
          if (e instanceof Error && e.name === "SyncBusyError") {
            console.log("[fuel-sync] Another sync is already running; skipping startup sync.");
            return;
          }
          console.error("[fuel-sync] Error:", e);
        });
    } else {
      console.log("[fuel-sync] Skipping startup sync — last sync was", lastSync.toISOString());
    }

    // Same staleness rule as the fuel sync. Independent of it: neither should be
    // able to hold the other up or fail it.
    const lastOdometer = await readSyncTimestamp(ODOMETER_SYNC_LAST_RUN);

    if (!lastOdometer || Date.now() - lastOdometer.getTime() > staleMs) {
      console.log("[odometer-sync] Auto-syncing on startup (last sync:", lastOdometer?.toISOString() ?? "never", ")");
      syncOdometers()
        .then((r) => console.log(`[odometer-sync] Done: ${r.updated} updated of ${r.unitsRead} units read`))
        .catch((e) => {
          if (e instanceof Error && e.name === "SyncBusyError") {
            console.log("[odometer-sync] Another sync is already running; skipping startup sync.");
            return;
          }
          console.error("[odometer-sync] Error:", e);
        });
    } else {
      console.log("[odometer-sync] Skipping startup sync — last sync was", lastOdometer.toISOString());
    }
  } catch (e) {
    console.error("[fuel-sync] Startup check failed:", e);
  }
}
