import { accountFromCookie } from "@/lib/auth";
import { HttpError } from "@/lib/errors";
import { getAppEnv, type AppEnv } from "@/lib/runtime";
import type { Account } from "@/lib/types";

export async function requireApiAccount(request: Request): Promise<{
  account: Account;
  env: AppEnv;
}> {
  const appEnv = getAppEnv();
  const account = await accountFromCookie(
    appEnv,
    request.headers.get("Cookie"),
  );
  if (!account) {
    throw new HttpError(401, "Sesja wygasła. Zaloguj się ponownie.");
  }
  return { account, env: appEnv };
}

export async function requireAdmin(request: Request): Promise<{
  account: Account;
  env: AppEnv;
}> {
  const context = await requireApiAccount(request);
  if (context.account.role !== "admin") {
    throw new HttpError(403, "Ta operacja wymaga konta administratora.");
  }
  return context;
}

export function assertPasswordChanged(account: Account): void {
  if (account.mustChangePassword) {
    throw new HttpError(
      428,
      "Najpierw zmień hasło tymczasowe w górnej części panelu.",
    );
  }
}

export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("Origin");
  const url = new URL(request.url);
  const isLocal = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if ((!origin && isLocal) || origin === url.origin) return;

  const forwardedHost =
    request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    request.headers.get("host")?.trim();
  const forwardedProtocol =
    request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
    url.protocol.replace(":", "");
  const allowedOrigins = new Set<string>();
  if (forwardedHost && /^(https?)$/.test(forwardedProtocol)) {
    allowedOrigins.add(`${forwardedProtocol}://${forwardedHost}`);
  }
  try {
    if (process.env.APP_URL) {
      allowedOrigins.add(new URL(process.env.APP_URL).origin);
    }
  } catch {
    // Niepoprawne APP_URL zostanie zgłoszone w logu harmonogramu.
  }
  if (origin && allowedOrigins.has(origin)) return;
  console.warn("[Radar Market] Odrzucono żądanie z obcego źródła.", {
    allowedOrigins: [...allowedOrigins],
    origin,
    requestOrigin: url.origin,
  });
  throw new HttpError(403, "Żądanie pochodzi z niedozwolonej strony.");
}

export function jsonError(error: unknown): Response {
  if (error instanceof HttpError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  const message =
    error instanceof Error ? error.message : "Wystąpił nieoczekiwany błąd.";
  return Response.json({ error: message }, { status: 500 });
}
