export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  try {
    const { prisma } = await import("./lib/prisma");
    const { syncFuelTransactions } = await import("./lib/azpetrol-sync");

    const agg = await prisma.fuelTransaction.aggregate({ _max: { transactionTime: true } });
    const lastSync = agg._max.transactionTime;
    const staleMs = 12 * 60 * 60 * 1000; // 12 hours

    if (!lastSync || Date.now() - lastSync.getTime() > staleMs) {
      console.log("[fuel-sync] Auto-syncing on startup (last sync:", lastSync?.toISOString() ?? "never", ")");
      syncFuelTransactions()
        .then((r) => console.log("[fuel-sync] Done:", r))
        .catch((e) => console.error("[fuel-sync] Error:", e));
    } else {
      console.log("[fuel-sync] Skipping startup sync — last sync was", lastSync.toISOString());
    }
  } catch (e) {
    console.error("[fuel-sync] Startup check failed:", e);
  }
}
