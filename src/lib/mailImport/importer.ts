import fs from "node:fs/promises";
import path from "node:path";
import QRCode from "qrcode";
import {
  createEsimRow,
  esimExistsByIccid,
  findStoreBySlug,
  listStores,
} from "@/lib/db";
import type { ParsedEsim } from "./parse";

export function qrStorage() {
  const absDbPath =
    process.env.DATABASE_PATH && path.isAbsolute(process.env.DATABASE_PATH)
      ? process.env.DATABASE_PATH
      : null;
  const uploadBase = process.env.UPLOAD_PATH
    ? path.resolve(process.env.UPLOAD_PATH)
    : absDbPath
      ? path.dirname(absDbPath)
      : path.join(process.cwd(), "public");
  return {
    dir: path.join(uploadBase, "qr"),
    useApiRoute: Boolean(process.env.UPLOAD_PATH || absDbPath),
  };
}

export function resolveImportStoreId(): number | null {
  const key = (process.env.AUTO_IMPORT_STORE_SLUG || "001").trim();
  const store =
    findStoreBySlug(key) ?? listStores().find((s) => s.name.trim() === key);
  return store?.id ?? null;
}

export async function importParsedEsim(
  esim: ParsedEsim,
  storeId: number,
): Promise<"imported" | "duplicate"> {
  if (esimExistsByIccid(esim.iccid)) return "duplicate";

  const { dir, useApiRoute } = qrStorage();
  await fs.mkdir(dir, { recursive: true });
  const fileName = `mail-${esim.iccid}.png`;
  const png = await QRCode.toBuffer(esim.lpa, { width: 512, margin: 2 });
  await fs.writeFile(path.join(dir, fileName), png);

  if (esimExistsByIccid(esim.iccid)) return "duplicate";
  createEsimRow({
    storeId,
    country: esim.country,
    planName: esim.planName,
    days: null,
    batchName: null,
    costPrice: null,
    sellPrice: null,
    notes: esim.orderNo ? `Email 自動入庫｜訂單 ${esim.orderNo}` : "Email 自動入庫",
    qrPath: useApiRoute ? `/api/qr/${fileName}` : `/qr/${fileName}`,
    iccid: esim.iccid,
    orderNo: esim.orderNo,
  });
  return "imported";
}
