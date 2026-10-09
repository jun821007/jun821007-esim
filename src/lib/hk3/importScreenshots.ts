import fs from "node:fs/promises";
import path from "node:path";
import QRCode from "qrcode";
import { createEsimRow, esimExistsByIccid } from "@/lib/db";
import { qrStorage } from "@/lib/mailImport/importer";
import { isFreshCard, queryHk3 } from "./query";
import { analyzeScreenshot, createOcrWorker } from "./screenshot";

export type Hk3ImportResult = {
  imported: { file: string; phone: string; planName: string | null }[];
  activated: { file: string; phone: string; status: string; activatedAt: string }[];
  duplicate: { file: string; phone: string }[];
  failed: { file: string; reason: string }[];
};

export function isTaiwanCountry(country: string | null | undefined): boolean {
  return /台灣|臺灣|taiwan/i.test(country ?? "");
}

export async function importHk3Screenshots(
  files: File[],
  opts: { storeId: number; country: string; planName: string | null; notes: string | null },
): Promise<Hk3ImportResult> {
  const result: Hk3ImportResult = { imported: [], activated: [], duplicate: [], failed: [] };
  if (files.length === 0) return result;

  const { dir, useApiRoute } = qrStorage();
  await fs.mkdir(dir, { recursive: true });
  const worker = await createOcrWorker();
  const seen = new Set<string>();

  try {
    for (const file of files) {
      const name = file.name || "未命名圖片";
      try {
        const info = await analyzeScreenshot(worker, Buffer.from(await file.arrayBuffer()));
        if (!info.lpa) {
          result.failed.push({ file: name, reason: "讀不到 QR Code" });
          continue;
        }
        if (!info.phone || !info.iccid) {
          result.failed.push({ file: name, reason: "辨識不到門號或 ICCID（截圖要拍到左邊的門號和卡號）" });
          continue;
        }

        const status = await queryHk3({ phone: info.phone });
        if (!status) {
          result.failed.push({ file: name, reason: `門號 ${info.phone} 查無資料，可能辨識錯誤` });
          continue;
        }
        // 用門號查回來的 ICCID 要和截圖上讀到的一致，才能確定兩個號碼都沒讀錯
        if (status.iccid !== info.iccid) {
          result.failed.push({
            file: name,
            reason: `門號 ${info.phone} 和 ICCID 對不上，可能辨識錯誤`,
          });
          continue;
        }

        if (seen.has(status.iccid) || esimExistsByIccid(status.iccid)) {
          result.duplicate.push({ file: name, phone: status.phone });
          continue;
        }
        if (!isFreshCard(status)) {
          result.activated.push({
            file: name,
            phone: status.phone,
            status: status.status || "未知",
            activatedAt: status.activatedAt,
          });
          continue;
        }

        const fileName = `hk3-${status.iccid}.png`;
        await fs.writeFile(
          path.join(dir, fileName),
          await QRCode.toBuffer(info.lpa, { width: 512, margin: 2 }),
        );
        const planName = opts.planName || status.planName;
        createEsimRow({
          storeId: opts.storeId,
          country: opts.country,
          planName,
          days: null,
          batchName: null,
          costPrice: null,
          sellPrice: null,
          notes: [opts.notes, `門號 ${status.phone}`].filter(Boolean).join("｜"),
          qrPath: useApiRoute ? `/api/qr/${fileName}` : `/qr/${fileName}`,
          iccid: status.iccid,
          phoneNo: status.phone,
        });
        seen.add(status.iccid);
        result.imported.push({ file: name, phone: status.phone, planName });
      } catch (err) {
        console.error("[hk3-import]", name, err);
        result.failed.push({ file: name, reason: "處理失敗（查詢網站可能暫時連不上），請稍後再試" });
      }
    }
  } finally {
    await worker.terminate();
  }
  return result;
}
