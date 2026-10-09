"use client";

import { useEffect, useState, useTransition } from "react";
import type { PosMapRule, PosPreset } from "@/lib/pos";
import { loadPosPresets, savePosMapAction } from "../posActions";

export default function PosMapEditor({ initialRules }: { initialRules: PosMapRule[] }) {
  const [rules, setRules] = useState<PosMapRule[]>(
    initialRules.length ? initialRules : [{ keyword: "台灣", preset: "" }],
  );
  const [presets, setPresets] = useState<PosPreset[] | null>(null);
  const [presetError, setPresetError] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, startSaving] = useTransition();

  useEffect(() => {
    loadPosPresets().then((r) => {
      if ("error" in r) setPresetError(r.error);
      else setPresets(r.presets);
    });
  }, []);

  const update = (i: number, patch: Partial<PosMapRule>) => {
    setSaved(false);
    setRules((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  };

  const presetOptions = presets ?? [];
  const priceOf = (name: string) => presetOptions.find((p) => p.name === name);

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-medium text-zinc-800">POS 裡的 eSIM 預設卡</h2>
        {presetError ? (
          <p className="mt-2 text-xs text-rose-600">讀不到 POS 預設卡：{presetError}</p>
        ) : !presets ? (
          <p className="mt-2 text-xs text-zinc-400">讀取中…</p>
        ) : presets.length === 0 ? (
          <p className="mt-2 text-xs text-zinc-400">POS 還沒有設定 eSIM 預設卡</p>
        ) : (
          <div className="mt-2 flex flex-wrap gap-2">
            {presets.map((p) => (
              <span
                key={p.name}
                className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs text-zinc-700"
              >
                {p.name}・{p.price > 0 ? `$${p.price}` : "售價現打"}
              </span>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-medium text-zinc-800">對照規則（由上往下，先對到的優先）</h2>
        <div className="mt-3 space-y-2">
          {rules.map((r, i) => {
            const preset = priceOf(r.preset);
            return (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <input
                  value={r.keyword}
                  onChange={(e) => update(i, { keyword: e.target.value })}
                  placeholder="關鍵字，例如：台灣"
                  className="w-40 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm outline-none focus:border-zinc-400 focus:bg-white"
                />
                <span className="text-zinc-400">→</span>
                <select
                  value={r.preset}
                  onChange={(e) => update(i, { preset: e.target.value })}
                  className="w-44 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm outline-none focus:border-zinc-400"
                >
                  <option value="">選 POS 預設卡</option>
                  {r.preset && !preset && <option value={r.preset}>{r.preset}（POS 已無此卡）</option>}
                  {presetOptions.map((p) => (
                    <option key={p.name} value={p.name}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <span className="text-xs text-zinc-500">
                  {preset ? (preset.price > 0 ? `$${preset.price}` : "待填價") : ""}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setSaved(false);
                    setRules((rs) => rs.filter((_, j) => j !== i));
                  }}
                  className="ml-auto text-xs text-rose-500 hover:text-rose-700"
                >
                  刪除
                </button>
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setSaved(false);
              setRules((rs) => [...rs, { keyword: "", preset: "" }]);
            }}
            className="rounded-full border border-zinc-300 bg-white px-4 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
          >
            ＋ 新增規則
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() =>
              startSaving(async () => {
                await savePosMapAction(rules);
                setSaved(true);
              })
            }
            className="rounded-full bg-zinc-900 px-4 py-2 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
          >
            {saving ? "儲存中…" : "儲存"}
          </button>
          {saved && <span className="text-xs text-emerald-600">✓ 已儲存</span>}
        </div>
      </section>
    </div>
  );
}
