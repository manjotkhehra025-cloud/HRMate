export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  if (process.env.NEXT_PHASE === "phase-development-build") return;
  const { startScheduler } = await import("./lib/jobs");
  startScheduler();
}
