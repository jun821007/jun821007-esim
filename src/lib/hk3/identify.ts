import type { Worker } from "tesseract.js";
import { queryHk3, type Hk3Status } from "./query";
import { decodeQr, extractCandidates, ocrDigitTexts } from "./screenshot";

const MAX_QUERIES_PER_IMAGE = 15;

// 門號或 ICCID 讀錯一碼可能剛好是同批的另一張卡，所以查回來的門號和 ICCID 都要出現在截圖上才算數
export async function identifyCard(
  worker: Worker,
  image: Buffer,
): Promise<{ lpa: string; status: Hk3Status } | { reason: string }> {
  const lpa = await decodeQr(image);
  if (!lpa) return { reason: "讀不到 QR Code" };

  const seenLines: string[] = [];
  const queried = new Map<string, Hk3Status | null>();
  const appears = (n: string) => seenLines.some((l) => l.includes(n));
  const confirmed = () =>
    [...queried.values()].find((s) => s && appears(s.iccid) && appears(s.phone)) ?? null;

  for await (const text of ocrDigitTexts(worker, image)) {
    seenLines.push(...text.split("\n").map((l) => l.replace(/\D/g, "")).filter(Boolean));
    const { phones, iccids } = extractCandidates(text);
    const attempts = [
      ...phones.map((phone) => ({ key: `p${phone}`, by: { phone } })),
      ...iccids.map((iccid) => ({ key: `i${iccid}`, by: { iccid } })),
    ];
    for (const { key, by } of attempts) {
      if (queried.has(key) || queried.size >= MAX_QUERIES_PER_IMAGE) continue;
      queried.set(key, await queryHk3(by));
    }
    const status = confirmed();
    if (status) return { lpa, status };
  }
  return {
    reason:
      queried.size > 0
        ? "辨識到的號碼查不到或對不上，請確認截圖清楚"
        : "辨識不到門號或 ICCID（截圖太小或模糊）",
  };
}
