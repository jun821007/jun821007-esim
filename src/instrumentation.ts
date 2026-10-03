export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  const { startMailWatcher } = await import("./lib/mailImport/watcher");
  startMailWatcher();
}
