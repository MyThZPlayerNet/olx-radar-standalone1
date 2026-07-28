import { authenticate, sessionCookie } from "@/lib/auth";
import { getAppEnv } from "@/lib/runtime";
import { assertSameOrigin, jsonError } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const payload = (await request.json()) as {
      password?: unknown;
      username?: unknown;
    };
    const result = await authenticate(
      getAppEnv(),
      request.url,
      payload.username,
      payload.password,
    );
    return Response.json(
      { account: result.account, message: "Zalogowano pomyślnie." },
      {
        headers: {
          "Set-Cookie": sessionCookie(result.token, request.url),
        },
      },
    );
  } catch (error) {
    return jsonError(error);
  }
}
