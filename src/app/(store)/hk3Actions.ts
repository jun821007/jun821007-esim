"use server";

import fs from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { createEsimRow, findEsimsByIds } from "@/lib/db";
import { getSession } from "@/lib/session";
import { isFreshCard, queryHk3 } from "@/lib/hk3/query";
import {
  importHk3Screenshots,
  isTaiwanCountry,
  type Hk3ImportResult,
} from "@/lib/hk3/importScreenshots";
import { qrStorage } from "@/lib/mailImport/importer";

export type ImageUploadResult =
  | { kind: "normal"; count: number }
  | ({ kind: "hk3" } & Hk3ImportResult)
  | { kind: "error" };

// 國家填「台灣」時走 3HK 截圖辨識與開通檢查，其他國家照原本方式直接存 QR 圖
export async function uploadQrImages(
  _prev: ImageUploadResult | null,
  formData: FormData,
): Promise<ImageUploadResult> {
  try {
    const session = await getSession();
    const storeId = session.storeId ?? 1;
    const country = (formData.get("country") as string)?.trim() || null;
    const planName = (formData.get("planName") as string)?.trim() || null;
    const notes = (formData.get("notes") as string)?.trim() || null;
    const files = (formData.getAll("qrFiles") as File[]).filter(
      (f) => f instanceof File && f.size > 0,
    );

    if (country && isTaiwanCountry(country)) {
      const result = await importHk3Screenshots(files, { storeId, country, planName, notes });
      if (result.imported.length) revalidatePath("/");
      return { kind: "hk3", ...result };
    }

    const { dir, useApiRoute } = qrStorage();
    await fs.mkdir(dir, { recursive: true });

    if (files.length === 0) {
      createEsimRow({
        storeId,
        country,
        planName,
        days: null,
        batchName: null,
        costPrice: null,
        sellPrice: null,
        notes,
        qrPath: null,
      });
      revalidatePath("/");
      return { kind: "normal", count: 1 };
    }

    for (const file of files) {
      const ext = file.name.split(".").pop() || "png";
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      await fs.writeFile(path.join(dir, fileName), Buffer.from(await file.arrayBuffer()));
      createEsimRow({
        storeId,
        country,
        planName,
        days: null,
        batchName: null,
        costPrice: null,
        sellPrice: null,
        notes,
        qrPath: useApiRoute ? `/api/qr/${fileName}` : `/qr/${fileName}`,
      });
    }
    revalidatePath("/");
    return { kind: "normal", count: files.length };
  } catch (err) {
    console.error("[upload]", err);
    return { kind: "error" };
  }
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
