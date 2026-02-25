import { deleteShippedEsims } from "@/lib/db";
import { NextResponse } from "next/server";

/**
 * 每月定期執行，刪除「已出貨且超過 30 天」的紀錄（已給客人／已給同行／作廢）。
 * 庫存（未使用）不刪。未滿 30 天的已出貨紀錄保留。
 *
 * 觸發方式：
 * - 外部 cron（如 cron-job.org）：每月 1 日呼叫此 API
 * - Vercel Cron：在 vercel.json 設定
 *
 * 需設定環境變數 CRON_SECRET，呼叫時帶上：
 * - Header: Authorization: Bearer <CRON_SECRET>
 * - 或 query: ?secret=<CRON_SECRET>
 */
export async function GET(request: Request) {
  return runCleanup(request);
}

export async function POST(request: Request) {
  return runCleanup(request);
}

async function runCleanup(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 500 },
    );
  }

  const authHeader = request.headers.get("authorization");
  const bearerSecret = authHeader?.replace(/^Bearer\s+/i, "");
  const urlSecret = new URL(request.url).searchParams.get("secret");

  if (bearerSecret !== secret && urlSecret !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const deleted = deleteShippedEsims();
    return NextResponse.json({
      ok: true,
      deleted,
      message: `已刪除 ${deleted} 筆超過 30 天的已出貨紀錄`,
    });
  } catch (err) {
    console.error("cleanup-history error:", err);
    return NextResponse.json(
      { error: String(err) },
      { status: 500 },
    );
  }
}
