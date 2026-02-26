import { getSession } from "@/lib/session";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const session = await getSession();
  session.destroy();
  const url = new URL(request.url);
  const next = url.searchParams.get("next") || "/login";
  const path = next.startsWith("/") ? next : `/${next}`;
  const proto = request.headers.get("x-forwarded-proto") || url.protocol.slice(0, -1);
  const host = request.headers.get("x-forwarded-host") || url.host;
  return NextResponse.redirect(`${proto}://${host}${path}`);
}
