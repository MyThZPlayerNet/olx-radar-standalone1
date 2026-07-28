import { requireApiAccount, jsonError } from "@/lib/security";
import { getRadarRow, publicStatus } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { env, account } = await requireApiAccount(request);
    return Response.json(
      publicStatus(await getRadarRow(env.DB, account.username)),
    );
  } catch (error) {
    return jsonError(error);
  }
}
