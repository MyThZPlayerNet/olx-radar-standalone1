import { runDueMonitors } from "@/lib/monitor";
import { getAppEnv } from "@/lib/runtime";

type SchedulerState = {
  running: boolean;
  timer: NodeJS.Timeout | null;
};

const schedulerGlobal = globalThis as typeof globalThis & {
  __olxRadarScheduler?: SchedulerState;
};

function tickSeconds(): number {
  const value = Number(process.env.MONITOR_TICK_SECONDS ?? 10);
  return Number.isFinite(value) ? Math.min(300, Math.max(5, value)) : 10;
}

function appUrl(): string {
  const value = process.env.APP_URL?.trim() || "http://localhost:3000";
  try {
    return new URL(value).toString();
  } catch {
    console.error("[Radar Market] APP_URL ma niepoprawny format.");
    return "http://localhost:3000";
  }
}

export function startMonitorScheduler(): void {
  const existing = schedulerGlobal.__olxRadarScheduler;
  if (existing?.timer) return;

  const state: SchedulerState = existing ?? { running: false, timer: null };
  schedulerGlobal.__olxRadarScheduler = state;

  const tick = async () => {
    if (state.running) return;
    state.running = true;
    try {
      await runDueMonitors(getAppEnv(), appUrl());
    } catch (error) {
      console.error("[Radar Market] Błąd harmonogramu:", error);
    } finally {
      state.running = false;
    }
  };

  const delay = tickSeconds() * 1000;
  state.timer = setInterval(() => void tick(), delay);
  state.timer.unref();
  setTimeout(() => void tick(), 1_000).unref();
  console.info(`[Radar Market] Monitor uruchomiony (kontrola co ${delay / 1000} s).`);
}
