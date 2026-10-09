"use server";

import { revalidatePath } from "next/cache";
import { findEsimsByIds, setEsimPosOrderId } from "@/lib/db";
import { getSession } from "@/lib/session";
import {
  fetchPosPresets,
  isPosStore,
  savePosMap,
  sendShipmentToPos,
  type PosMapRule,
  type PosPreset,
} from "@/lib/pos";

export type PosPushResult =
  | { ok: true; sent: number; needsPrice: number }
  | { ok: false; error: string };

// 出貨後呼叫：把還沒進 POS 的卡依客戶名稱分批開成掛帳未結單；失敗可重按，不會重複掛帳
export async function pushShipmentToPos(ids: number[]): Promise<PosPushResult> {
  const session = await getSession();
  const storeId = session.storeId ?? 1;
  if (!isPosStore(storeId)) return { ok: true, sent: 0, needsPrice: 0 };

  const rows = findEsimsByIds(ids, storeId).filter(
    (e) => (e.status === "CUSTOMER" || e.status === "PEER") && e.customerName && !e.posOrderId,
  );
  const groups = new Map<string, typeof rows>();
  for (const e of rows) {
    const name = (e.customerName as string).trim();
    groups.set(name, [...(groups.get(name) ?? []), e]);
  }

  let sent = 0;
  let needsPrice = 0;
  try {
    for (const [customer, esims] of groups) {
      const r = await sendShipmentToPos(esims, customer);
      setEsimPosOrderId(esims.map((e) => e.id), r.orderId);
      sent += esims.length;
      needsPrice += r.needsPrice;
    }
  } catch (err) {
    console.error("[pos] 掛帳失敗:", err);
    revalidatePath("/history");
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
  revalidatePath("/history");
  return { ok: true, sent, needsPrice };
}

export async function loadPosPresets(): Promise<{ presets: PosPreset[] } | { error: string }> {
  try {
    return { presets: await fetchPosPresets() };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function savePosMapAction(rules: PosMapRule[]): Promise<void> {
  const session = await getSession();
  if (!isPosStore(session.storeId ?? 1)) return;
  savePosMap(
    rules
      .map((r) => ({ keyword: r.keyword.trim(), preset: r.preset.trim() }))
      .filter((r) => r.keyword && r.preset),
  );
}
