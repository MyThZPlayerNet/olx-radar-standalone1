import {
  changePassword,
  clearedSessionCookie,
  deleteSession,
} from "@/lib/auth";
import { assertSameOrigin, jsonError, requireApiAccount } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const { env, account } = await requireApiAccount(request);
    const payload = (await request.json()) as {
      currentPassword?: unknown;
      newPassword?: unknown;
    };
    await changePassword(
      env,
      account.username,
      payload.currentPassword,
      payload.newPassword,
    );
    await deleteSession(env, request.headers.get("Cookie"));
    return Response.json(
      { message: "Hasło zostało zmienione. Zaloguj się ponownie." },
      { headers: { "Set-Cookie": clearedSessionCookie(request.url) } },
    );
  } catch (error) {
    return jsonError(error);
  }
}
