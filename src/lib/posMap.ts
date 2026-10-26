export type PosPreset = { name: string; price: number; cost: number };
/** 出貨名稱（國家｜方案）→ POS 預設卡名稱。價錢出貨當下向 presets 讀，不存在這裡。 */
export type PosBinding = { key: string; presetName: string };
export type ShipmentName = { key: string; title: string; subtitle: string; count: number };

export type PosShipItem = {
  esimId: number;
  name: string;
  presetName: string;
  price: number;
  cost: number;
  needsPrice: boolean;
};

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

/** 已綁定且 presets 還有這張卡 → 用該卡的售價／成本。售價 0 是現打。沒綁或卡已刪 → 售價成本 0，不擋出貨。 */
export function resolveShipItem(
  esim: { id: number; country?: string | null; planName?: string | null },
  bindings: PosBinding[],
  presets: PosPreset[],
): PosShipItem {
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
