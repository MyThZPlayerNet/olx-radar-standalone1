import { clearedSessionCookie, deleteSession } from "@/lib/auth";
import { getAppEnv } from "@/lib/runtime";
import { assertSameOrigin, jsonError } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await deleteSession(getAppEnv(), request.headers.get("Cookie"));
    return Response.json(
      { message: "Wylogowano." },
      { headers: { "Set-Cookie": clearedSessionCookie(request.url) } },
    );
  } catch (error) {
    return jsonError(error);
  }
}
