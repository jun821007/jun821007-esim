"use client";

import { useState, useTransition } from "react";
import type { PosBinding, PosPreset, ShipmentName } from "@/lib/pos";
import { bindPosPresetAction, loadPosPresets } from "../posActions";

export default function PosMapEditor({
  names,
  initialBindings,
}: {
  names: ShipmentName[];
  initialBindings: PosBinding[];
}) {
  const [bindings, setBindings] = useState<PosBinding[]>(initialBindings);
  const [presets, setPresets] = useState<PosPreset[] | null>(null);
  const [presetError, setPresetError] = useState("");
  const [loadingPresets, setLoadingPresets] = useState(false);
  const [query, setQuery] = useState("");
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [saving, startSaving] = useTransition();

  const presetOf = (name: string) =>
    presets?.find((p) => p.name.replace(/\s+/g, "").toLowerCase() === name.replace(/\s+/g, "").toLowerCase());

  const boundOf = (key: string) => bindings.find((b) => b.key === key);

  const refreshPresets = async () => {
    setLoadingPresets(true);
    setPresetError("");
    const r = await loadPosPresets();
    setLoadingPresets(false);
    if ("error" in r) {
      setPresetError(r.error);
      return;
    }
    setPresets(r.presets);
  };

  const open = (key: string) => {
    setNotice("");
    setActiveKey(key);
    if (!presets && !loadingPresets) void refreshPresets();
  };

  const save = (key: string, presetName: string | null) => {
    setNotice("");
    startSaving(async () => {
      const next = await bindPosPresetAction(key, presetName);
      setBindings(next);
      setActiveKey(null);
      setNotice(presetName ? "已綁定" : "已解除");
    });
  };

  const q = query.trim().toLowerCase();
  const filtered = names
    .map((n) => ({ ...n, binding: boundOf(n.key) }))
    .filter((n) => !q || `${n.title} ${n.subtitle} ${n.binding?.presetName || ""}`.toLowerCase().includes(q))
    .sort((a, b) => Number(!!a.binding) - Number(!!b.binding) || a.title.localeCompare(b.title, "zh-Hant"));

  const active = names.find((n) => n.key === activeKey) || null;
  const activeBinding = active ? boundOf(active.key) : undefined;

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜尋國家或方案"
            className="min-w-0 flex-1 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm outline-none focus:border-zinc-400 focus:bg-white"
          />
          <span className="text-xs text-zinc-500">
            {filtered.length} 種{bindings.length ? `・已綁 ${bindings.length}` : ""}
          </span>
        </div>
        {notice && <p className="mt-2 text-xs text-emerald-600">{notice}</p>}
        {names.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-400">還沒有庫存或出貨紀錄，入庫後這裡才選得到。</p>
        ) : filtered.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-400">沒有符合的名稱</p>
        ) : (
          <ul className="mt-3 divide-y divide-zinc-100">
            {filtered.map((n) => {
              const preset = n.binding ? presetOf(n.binding.presetName) : undefined;
              const missing = n.binding && presets && !preset;
              return (
                <li key={n.key}>
                  <button
                    type="button"
                    onClick={() => open(n.key)}
                    className="flex w-full items-start justify-between gap-3 py-3 text-left"
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-zinc-900">{n.title}</span>
                      {n.subtitle && <span className="mt-0.5 block text-xs text-zinc-500">{n.subtitle}</span>}
                      <span className="mt-0.5 block text-[11px] text-zinc-400">{n.count} 張</span>
                    </span>
                    <span className="shrink-0 text-right text-xs">
                      {n.binding ? (
                        <>
                          <span className="block font-medium text-emerald-700">{n.binding.presetName}</span>
                          <span className="mt-0.5 block text-zinc-500">
                            {missing
                              ? "POS 已無此卡"
                              : preset
                                ? preset.price > 0
                                  ? `$${preset.price}／成本 $${preset.cost}`
                                  : `售價現打／成本 $${preset.cost}`
                                : "點開看售價"}
                          </span>
                        </>
                      ) : (
                        <span className="rounded-full bg-zinc-100 px-2 py-1 text-zinc-500">未綁定</span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {active && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={() => !saving && setActiveKey(null)}>
          <div
            className="max-h-[85vh] w-full max-w-md overflow-auto rounded-t-2xl bg-white p-4 shadow-xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-zinc-900">{active.title}</h2>
                {active.subtitle && <p className="mt-0.5 text-xs text-zinc-500">{active.subtitle}</p>}
                <p className="mt-1 text-xs text-zinc-400">選一張 POS 常用卡。售價和成本以 POS 為準。</p>
              </div>
              <button type="button" onClick={() => setActiveKey(null)} className="text-sm text-zinc-500">
                關閉
              </button>
            </div>

            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-700">POS 常用卡</span>
              <button
                type="button"
                onClick={() => void refreshPresets()}
                disabled={loadingPresets}
                className="text-xs text-zinc-600 underline disabled:opacity-50"
              >
                {loadingPresets ? "讀取中…" : "重新讀取"}
              </button>
            </div>
            {presetError && <p className="mt-2 text-xs text-rose-600">{presetError}</p>}
            {!presets && !presetError && <p className="mt-3 text-xs text-zinc-400">讀取中…</p>}
            {presets && presets.length === 0 && <p className="mt-3 text-xs text-zinc-400">POS 還沒有常用卡</p>}
            <div className="mt-2 space-y-2">
              {(presets || []).map((p) => {
                const selected = activeBinding?.presetName === p.name;
                return (
                  <button
                    key={p.name}
                    type="button"
                    disabled={saving}
                    onClick={() => save(active.key, p.name)}
                    className={`flex w-full items-center justify-between rounded-xl border px-3 py-3 text-left text-sm disabled:opacity-60 ${
                      selected ? "border-emerald-500 bg-emerald-50" : "border-zinc-200 hover:bg-zinc-50"
                    }`}
                  >
                    <span className="font-medium text-zinc-900">{p.name}</span>
                    <span className="text-xs text-zinc-500">
                      {p.price > 0 ? `$${p.price}` : "售價現打"}・成本 ${p.cost}
                    </span>
                  </button>
                );
              })}
            </div>
            {activeBinding && (
              <button
                type="button"
                disabled={saving}
                onClick={() => save(active.key, null)}
                className="mt-4 text-xs text-rose-600 disabled:opacity-60"
              >
                解除綁定
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
