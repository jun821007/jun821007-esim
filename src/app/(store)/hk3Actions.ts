"use server";

import fs from "node:fs/promises";
import path from "node:path";
import QRCode from "qrcode";
import { revalidatePath } from "next/cache";
import { createEsimRow, esimExistsByIccid, findEsimsByIds } from "@/lib/db";
import { getSession } from "@/lib/session";
import { isFreshCard, queryHk3 } from "@/lib/hk3/query";
import { analyzeScreenshot, createOcrWorker } from "@/lib/hk3/screenshot";
import { qrStorage } from "@/lib/mailImport/importer";

export type Hk3ImportResult = {
  imported: { file: string; phone: string; planName: string | null }[];
  activated: { file: string; phone: string; status: string; activatedAt: string }[];
  duplicate: { file: string; phone: string }[];
  failed: { file: string; reason: string }[];
};

export async function importHk3Screenshots(
  _prev: Hk3ImportResult | null,
  formData: FormData,
): Promise<Hk3ImportResult> {
  const session = await getSession();
  const storeId = session.storeId ?? 1;
  const files = (formData.getAll("screenshots") as File[]).filter(
    (f) => f instanceof File && f.size > 0,
  );
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
          result.failed.push({ file: name, reason: "辨識不到門號或 ICCID" });
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
        createEsimRow({
          storeId,
          country: "台灣",
          planName: status.planName,
          days: null,
          batchName: null,
          costPrice: null,
          sellPrice: null,
          notes: `3HK 門號 ${status.phone}`,
          qrPath: useApiRoute ? `/api/qr/${fileName}` : `/qr/${fileName}`,
          iccid: status.iccid,
          phoneNo: status.phone,
        });
        seen.add(status.iccid);
        result.imported.push({ file: name, phone: status.phone, planName: status.planName });
      } catch (err) {
        console.error("[hk3-import]", name, err);
        result.failed.push({ file: name, reason: "處理失敗（查詢網站可能暫時連不上），請稍後再試" });
      }
    }
  } finally {
    await worker.terminate();
  }

  if (result.imported.length) revalidatePath("/");
  return result;
}

export type Hk3ShipCheck = {
  activated: { id: number; phone: string; status: string }[];
  failed: { id: number; phone: string }[];
};

export async function checkHk3BeforeShip(ids: number[]): Promise<Hk3ShipCheck> {
  const session = await getSession();
  const storeId = session.storeId ?? 1;
  const cards = findEsimsByIds(ids, storeId).filter((e) => e.phoneNo);
  const check: Hk3ShipCheck = { activated: [], failed: [] };

  await Promise.all(
    cards.map(async (card) => {
      const phone = card.phoneNo as string;
      try {
        const status = await queryHk3({ phone });
        if (!status || status.iccid !== card.iccid) {
          check.failed.push({ id: card.id, phone });
        } else if (!isFreshCard(status)) {
          check.activated.push({ id: card.id, phone, status: status.status || "未知" });
        }
      } catch {
        check.failed.push({ id: card.id, phone });
      }
    }),
  );
  return check;
}
