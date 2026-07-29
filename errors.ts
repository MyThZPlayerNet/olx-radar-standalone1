import { getAppEnv } from "@/lib/runtime";
import { ensureSchema } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  try {
    const env = getAppEnv();
    await ensureSchema(env.DB);
    return Response.json({
      service: "radar-market",
      status: "ok",
      time: new Date().toISOString(),
    });
  } catch {
    return Response.json(
      { service: "radar-market", status: "error" },
      { status: 503 },
    );
  }
}
