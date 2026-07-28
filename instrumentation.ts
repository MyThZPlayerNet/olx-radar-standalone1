export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startMonitorScheduler } = await import("@/lib/scheduler");
  startMonitorScheduler();
}
