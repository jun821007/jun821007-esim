import { NextResponse } from "next/server";
import { runMailImportOnce } from "@/lib/mailImport/watcher";

/**
 * 手動觸發一次 Gmail 自動入庫掃描（平常由主機啟動時的即時監聽自動處理）。
 *
 * 需設定環境變數 CRON_SECRET，呼叫時帶上：
 * - Header: Authorization: Bearer <CRON_SECRET>
 * - 或 query: ?secret=<CRON_SECRET>
 */
export async function GET(request: Request) {
  return runImport(request);
}

export async function POST(request: Request) {
  return runImport(request);
}

async function runImport(request: Request) {
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
    const result = await runMailImportOnce();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("import-mail error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
