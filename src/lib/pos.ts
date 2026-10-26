import crypto from "node:crypto";
import { findStoreById, getSetting, setSetting, type EsimRow } from "@/lib/db";
import { resolveShipItem, type PosBinding, type PosPreset } from "@/lib/posMap";

const MAP_KEY = "pos.esimMap";

export type { PosBinding, PosPreset, PosShipItem, ShipmentName } from "@/lib/posMap";
export { collectShipmentNames, resolveShipItem, shipmentIdentity } from "@/lib/posMap";

function posConfig() {
  const url = process.env.POS_API_URL?.trim().replace(/\/+$/, "");
  const key = process.env.POS_ESIM_KEY?.trim();
  return url && key ? { url, key } : null;
}

export function isPosStore(storeId: number): boolean {
  if (!posConfig()) return false;
  const slug = (process.env.POS_STORE_SLUG || "001").trim();
  const store = findStoreById(storeId);
  return Boolean(store && (store.slug === slug || store.name.trim() === slug));
}

export function getPosBindings(): PosBinding[] {
  try {
    const v = JSON.parse(getSetting(MAP_KEY) || "[]");
    if (!Array.isArray(v)) return [];
    const out: PosBinding[] = [];
    for (const r of v) {
      const key = String(r?.key || r?.keyword || "").trim();
      const presetName = String(r?.presetName || r?.preset || "").trim();
      if (key && presetName) out.push({ key, presetName });
    }
    return out;
  } catch {
    return [];
  }
}

export function savePosBinding(key: string, presetName: string | null, previousKey?: string | null): PosBinding[] {
  const drop = new Set([key, previousKey || ""].filter(Boolean));
  const next = getPosBindings().filter((b) => !drop.has(b.key));
  const name = presetName?.trim();
  if (name) next.push({ key, presetName: name });
  setSetting(MAP_KEY, JSON.stringify(next));
  return next;
}

async function posFetch(path: string, init?: RequestInit) {
  const cfg = posConfig();
  if (!cfg) throw new Error("未設定 POS_API_URL / POS_ESIM_KEY");
  let res: Response;
  try {
    res = await fetch(`${cfg.url}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", "x-esim-key": cfg.key, ...init?.headers },
      signal: AbortSignal.timeout(30_000),
      cache: "no-store",
    });
  } catch {
    throw new Error("連不上 POS（網路錯誤或逾時），請再試一次");
  }
  const data = await res.json().catch(() => null);
  if (!res.ok || data?.status !== "success") {
    throw new Error(data?.msg || `POS 回應 ${res.status}`);
  }
  return data;
}

export async function fetchPosPresets(): Promise<PosPreset[]> {
  const data = await posFetch("/esim-ship/presets");
  return Array.isArray(data.list) ? data.list : [];
}

/** 同一次出貨固定產生同一個單號，重送時 POS 會認出來不重複掛帳；衝正後再出貨會因出貨時間不同而換單號 */
function posOrderIdFor(esims: EsimRow[]): string {
  const key = [...esims]
    .sort((a, b) => a.id - b.id)
    .map((e) => `${e.id}@${e.updatedAt ?? ""}`)
    .join(",");
  const hash = crypto.createHash("sha1").update(key).digest("hex");
  return `ESIM${hash.slice(0, 10).toUpperCase()}`;
}

/** POS 回 success 才代表那張卡已不在 POS 未結單；失敗會丟出 POS 給的中文原因 */
export async function revertEsimInPos(esimId: number, orderId: string): Promise<void> {
  await posFetch("/esim-ship/revert", {
    method: "POST",
    body: JSON.stringify({ orderId, esimId }),
  });
}

export async function sendShipmentToPos(
  esims: EsimRow[],
  customer: string,
): Promise<{ orderId: string; needsPrice: number }> {
  const [presets, bindings] = [await fetchPosPresets(), getPosBindings()];
  const orderId = posOrderIdFor(esims);
  const items = esims.map((e) => resolveShipItem(e, bindings, presets));
  await posFetch("/esim-ship", {
    method: "POST",
    body: JSON.stringify({ orderId, customer, person: "eSIM後台", items }),
  });
  return { orderId, needsPrice: items.filter((i) => i.needsPrice).length };
}
