import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { signShareUrl } from "@/lib/share";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session.storeId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const idsRaw = request.nextUrl.searchParams.get("ids") || "";
  const ids = idsRaw.split(",").map((v) => Number(v.trim())).filter((v) => !Number.isNaN(v) && v > 0);
  if (ids.length === 0) {
    return NextResponse.json({ error: "Invalid ids" }, { status: 400 });
  }
  const origin = request.nextUrl.origin;
  const url = signShareUrl(ids, origin);
  return NextResponse.json({ url });
}
