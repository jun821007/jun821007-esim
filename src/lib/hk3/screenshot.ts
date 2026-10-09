import os from "node:os";
import jsQR from "jsqr";
import sharp from "sharp";
import { createWorker, type Worker } from "tesseract.js";

export type ScreenshotInfo = {
  lpa: string | null;
  phone: string | null;
  iccid: string | null;
};

async function decodeQr(image: Buffer): Promise<string | null> {
  for (const scale of [1, 2]) {
    const meta = await sharp(image).metadata();
    const width = Math.round((meta.width ?? 0) * scale);
    if (!width) return null;
    const { data, info } = await sharp(image)
      .resize({ width })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const code = jsQR(new Uint8ClampedArray(data), info.width, info.height);
    if (code?.data) return code.data.trim();
  }
  return null;
}

export async function createOcrWorker(): Promise<Worker> {
  const worker = await createWorker("eng", 1, { cachePath: os.tmpdir() });
  await worker.setParameters({ tessedit_char_whitelist: "0123456789" });
  return worker;
}

// 截圖通常是縮小過的，直接辨識會讀不到數字，要先放大
async function readNumbers(worker: Worker, image: Buffer): Promise<string> {
  const meta = await sharp(image).metadata();
  const scale = Math.min(4, Math.max(1, 4000 / (meta.width ?? 1000)));
  const big = await sharp(image)
    .resize({ width: Math.round((meta.width ?? 1000) * scale), kernel: "cubic" })
    .grayscale()
    .png()
    .toBuffer();
  const { data } = await worker.recognize(big);
  return data.text;
}

export async function analyzeScreenshot(worker: Worker, image: Buffer): Promise<ScreenshotInfo> {
  const [lpa, text] = await Promise.all([decodeQr(image), readNumbers(worker, image)]);
  const iccid = text.match(/(?<!\d)8985\d{14,18}(?!\d)/)?.[0] ?? null;
  const phone = text.match(/(?<!\d)\d{8}(?!\d)/)?.[0] ?? null;
  return { lpa: lpa?.startsWith("LPA:") ? lpa : null, phone, iccid };
}
