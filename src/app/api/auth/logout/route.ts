import { getSession } from "@/lib/session";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const session = await getSession();
  session.destroy();
  const url = new URL(request.url);
  const base = `${url.protocol}//${url.host}`;
  const next = url.searchParams.get("next") || "/login";
  return NextResponse.redirect(`${base}${next.startsWith("/") ? next : `/${next}`}`);
}
