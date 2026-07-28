import { accountFromCookie } from "@/lib/auth";
import { getAppEnv } from "@/lib/runtime";
import { jsonError } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const account = await accountFromCookie(
      getAppEnv(),
      request.headers.get("Cookie"),
    );
    return Response.json({ account });
  } catch (error) {
    return jsonError(error);
  }
}
