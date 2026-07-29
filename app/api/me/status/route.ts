import { requireApiAccount, jsonError } from "@/lib/security";
import { getRadarRows, publicStatus } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { env, account } = await requireApiAccount(request);
    const rows = await getRadarRows(env.DB, account.username);
    return Response.json({
      olx: publicStatus(rows.olx),
      vinted: publicStatus(rows.vinted),
    });
  } catch (error) {
    return jsonError(error);
  }
}
