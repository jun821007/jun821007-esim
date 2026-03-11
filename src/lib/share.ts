import crypto from "node:crypto";

const SECRET = process.env.SHARE_SECRET || "esim-share-default-change-in-production";

function getHmac(ids: number[]): string {
  const payload = ids.sort((a, b) => a - b).join(",");
  return crypto.createHmac("sha256", SECRET).update(payload).digest("base64url");
}

export function signShareUrl(ids: number[], origin: string): string {
  if (ids.length === 0) return "";
  const idsStr = ids.sort((a, b) => a - b).join(",");
  const sig = getHmac(ids);
  return `${origin}/share?ids=${idsStr}&sig=${sig}`;
}

export function verifyShareSig(ids: number[], sig: string): boolean {
  if (ids.length === 0 || !sig || sig.length < 10) return false;
  const expected = getHmac(ids);
  try {
    const a = Buffer.from(sig, "base64url");
    const b = Buffer.from(expected, "base64url");
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
