import crypto from "node:crypto";
import { findStoreById, getSetting, setSetting, type EsimRow } from "@/lib/db";

const MAP_KEY = "pos.esimMap";

export type PosPreset = { name: string; price: number; cost: number };
/** 出貨名稱（國家｜方案）→ POS 預設卡名稱。價錢出貨當下向 presets 讀，不存在這裡。 */
export type PosBinding = { key: string; presetName: string };
export type ShipmentName = { key: string; title: string; subtitle: string; count: number };

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

export function savePosBinding(key: string, presetName: string | null): PosBinding[] {
  const next = getPosBindings().filter((b) => b.key !== key);
  const name = presetName?.trim();
  if (name) next.push({ key, presetName: name });
  setSetting(MAP_KEY, JSON.stringify(next));
  return next;
}

/** 一組國家＋方案一個識別。只有國家、或只有方案時，識別就是那個名稱。 */
export function shipmentIdentity(esim: {
  country?: string | null;
  planName?: string | null;
}): { key: string; title: string; subtitle: string } | null {
  const country = (esim.country || "").trim();
  const plan = (esim.planName || "").trim();
  if (country && plan) return { key: `${country}｜${plan}`, title: country, subtitle: plan };
  const title = country || plan;
  return title ? { key: title, title, subtitle: "" } : null;
}

export function collectShipmentNames(
  rows: { country?: string | null; planName?: string | null }[],
): ShipmentName[] {
  const map = new Map<string, ShipmentName>();
  for (const row of rows) {
    const id = shipmentIdentity(row);
    if (!id) continue;
    const cur = map.get(id.key);
    if (cur) cur.count += 1;
    else map.set(id.key, { ...id, count: 1 });
  }
  return [...map.values()].sort(
    (a, b) => a.title.localeCompare(b.title, "zh-Hant") || a.subtitle.localeCompare(b.subtitle, "zh-Hant"),
  );
}

function normName(s: string): string {
  return s.replace(/\s+/g, "").toLowerCase();
}

export type PosShipItem = {
  esimId: number;
  name: string;
  presetName: string;
  price: number;
  cost: number;
  needsPrice: boolean;
};

/** 已綁定且 presets 還有這張卡 → 用該卡的售價／成本。售價 0 是現打。沒綁或卡已刪 → 售價成本 0，不擋出貨。 */
export function resolveShipItem(esim: EsimRow, bindings: PosBinding[], presets: PosPreset[]): PosShipItem {
  const id = shipmentIdentity(esim);
  const binding = id ? bindings.find((b) => b.key === id.key) : undefined;
  const preset = binding ? presets.find((p) => normName(p.name) === normName(binding.presetName)) : undefined;
  const title = id?.title || esim.country || esim.planName || "";
  const fallbackName = id?.subtitle ? `${title} ${id.subtitle}` : title;
  if (!preset) {
    return { esimId: esim.id, name: fallbackName, presetName: "", price: 0, cost: 0, needsPrice: true };
  }
  const price = Number(preset.price) || 0;
  const cost = Number(preset.cost) || 0;
  return {
    esimId: esim.id,
    name: preset.name,
    presetName: preset.name,
    price,
    cost,
    needsPrice: !(price > 0),
  };
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
