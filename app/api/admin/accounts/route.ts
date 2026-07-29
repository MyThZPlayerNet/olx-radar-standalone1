import {
  createManagedAccount,
  deactivateManagedAccount,
  listAdminAccountOverviews,
  setManagedRadarActive,
} from "@/lib/auth";
import { assertSameOrigin, jsonError, requireAdmin } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { env } = await requireAdmin(request);
    return Response.json({ accounts: await listAdminAccountOverviews(env) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const { env } = await requireAdmin(request);
    const payload = (await request.json()) as {
      displayName?: unknown;
      username?: unknown;
    };
    return Response.json(
      await createManagedAccount(env, payload.username, payload.displayName),
      { status: 201 },
    );
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);
    const { env } = await requireAdmin(request);
    const payload = (await request.json()) as {
      active?: unknown;
      platform?: unknown;
      username?: unknown;
    };
    const result = await setManagedRadarActive(
      env,
      payload.username,
      payload.platform,
      payload.active,
    );
    return Response.json({
      message: `${result.platform === "olx" ? "OLX" : "Vinted"} użytkownika @${result.username} został ${result.status.active ? "uruchomiony" : "zatrzymany"}.`,
      status: result.status,
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request);
    const { env } = await requireAdmin(request);
    const payload = (await request.json()) as { username?: unknown };
    await deactivateManagedAccount(env, payload.username);
    return Response.json({ message: "Dostęp użytkownika został wyłączony." });
  } catch (error) {
    return jsonError(error);
  }
}
