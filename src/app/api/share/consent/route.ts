import { NextRequest, NextResponse } from "next/server";
import { createShareConsentLog, type ShareConsentDecision } from "@/lib/db";
import { verifyShareSig } from "@/lib/share";

const POLICY_VERSION = "v1-2026-06-22";

function parseIds(idsRaw: string): number[] {
  return idsRaw
    .split(",")
    .map((v) => Number(v.trim()))
    .filter((v) => !Number.isNaN(v) && v > 0);
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const payload = body as {
    ids?: string;
    sig?: string;
    decision?: ShareConsentDecision;
  };

  const idsText = (payload.ids || "").trim();
  const sig = (payload.sig || "").trim();
  const decision = payload.decision;
  const ids = parseIds(idsText);

  if (
    ids.length === 0 ||
    !sig ||
    (decision !== "agree" && decision !== "decline") ||
    !verifyShareSig(ids, sig)
  ) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const ip = (request.headers.get("x-forwarded-for") || "")
    .split(",")[0]
    ?.trim() || null;
  const userAgent = request.headers.get("user-agent") || null;

  createShareConsentLog({
    idsText,
    sig,
    decision,
    policyVersion: POLICY_VERSION,
    ip,
    userAgent,
  });

  return NextResponse.json({ ok: true });
}

