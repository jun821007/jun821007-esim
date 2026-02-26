import { getSession } from "@/lib/session";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const session = await getSession();
  session.destroy();
  const url = new URL(request.url);
  const next = url.searchParams.get("next") || "/login";
  const path = next.startsWith("/") ? next : `/${next}`;
  return NextResponse.redirect(path);
}
