import os from "node:os";
import jsQR from "jsqr";
import sharp from "sharp";
import { createWorker, PSM, type Worker } from "tesseract.js";

export async function decodeQr(image: Buffer): Promise<string | null> {
  const meta = await sharp(image).metadata();
  if (!meta.width) return null;
  for (const scale of [1, 2, 0.5]) {
    const { data, info } = await sharp(image)
      .resize({ width: Math.round(meta.width * scale) })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const code = jsQR(new Uint8ClampedArray(data), info.width, info.height);
    if (code?.data?.startsWith("LPA:")) return code.data.trim();
  }
  return null;
}

export async function createOcrWorker(): Promise<Worker> {
  const worker = await createWorker("eng", 1, { cachePath: os.tmpdir() });
  await worker.setParameters({ tessedit_char_whitelist: "0123456789" });
  return worker;
}

type Variant = { width: number; sharpen?: boolean; threshold?: number; psm: PSM };

// 截圖解析度不一，直接辨識常讀錯；依序換放大倍率、銳化、黑白化與版面模式重試
const VARIANTS: Variant[] = [
  { width: 4000, psm: PSM.AUTO },
  { width: 1500, psm: PSM.AUTO },
  { width: 4000, psm: PSM.SPARSE_TEXT },
  { width: 1500, psm: PSM.SINGLE_BLOCK },
  { width: 2500, sharpen: true, psm: PSM.AUTO },
  { width: 3000, threshold: 160, psm: PSM.AUTO },
];

export async function* ocrDigitTexts(worker: Worker, image: Buffer): AsyncGenerator<string> {
  for (const v of VARIANTS) {
    let pipeline = sharp(image)
      .resize({ width: v.width, kernel: "lanczos3" })
      .grayscale()
      .normalize();
    if (v.sharpen) pipeline = pipeline.sharpen();
    if (v.threshold) pipeline = pipeline.threshold(v.threshold);
    await worker.setParameters({ tessedit_pageseg_mode: v.psm });
    const { data } = await worker.recognize(await pipeline.png().toBuffer());
    yield data.text;
  }
}

/** 從辨識文字中找出可能的門號（8 碼）與 ICCID（8985 開頭）；欄位黏在一起時也拆得開 */
export function extractCandidates(text: string): { phones: string[]; iccids: string[] } {
  const phones = new Set<string>();
  const iccids = new Set<string>();
  for (const line of text.split("\n")) {
    const digits = line.replace(/\D/g, "");
    for (const m of line.matchAll(/(?<!\d)\d{8}(?!\d)/g)) phones.add(m[0]);
    for (const m of digits.matchAll(/8985\d{14,16}/g)) {
      for (let len = 18; len <= m[0].length; len++) iccids.add(m[0].slice(0, len));
      if (m.index >= 8) phones.add(digits.slice(m.index - 8, m.index));
    }
  }
  return { phones: [...phones], iccids: [...iccids] };
}
