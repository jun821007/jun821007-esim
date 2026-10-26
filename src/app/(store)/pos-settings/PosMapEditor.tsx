"use client";

import { useState, useTransition } from "react";
import { shipmentIdentity, type PosBinding, type PosPreset, type ShipmentName } from "@/lib/posMap";
import { bindPosPresetAction, loadPosPresets } from "../posActions";

type Draft = {
  previousKey: string | null;
  country: string;
  plan: string;
  countryQ: string;
  planQ: string;
  handCountry: boolean;
  handPlan: boolean;
  presetName: string;
};

function splitKey(key: string, names: ShipmentName[]): { country: string; plan: string } {
  const found = names.find((n) => n.key === key);
  if (found) return { country: found.title, plan: found.subtitle };
  const i = key.indexOf("｜");
  if (i >= 0) return { country: key.slice(0, i), plan: key.slice(i + 1) };
  return { country: key, plan: "" };
}

function uniq(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, "zh-Hant"));
}

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
  const [draft, setDraft] = useState<Draft | null>(null);
  const [notice, setNotice] = useState("");
  const [saving, startSaving] = useTransition();

  const countries = uniq(names.map((n) => n.title));
  const plansFor = (country: string) =>
    uniq(names.filter((n) => !country || n.title === country).map((n) => n.subtitle));

  const presetOf = (name: string) =>
    presets?.find((p) => p.name.replace(/\s+/g, "").toLowerCase() === name.replace(/\s+/g, "").toLowerCase());
  const boundOf = (key: string) => bindings.find((b) => b.key === key);

  const refreshPresets = async () => {
    setLoadingPresets(true);
    setPresetError("");
    const r = await loadPosPresets();
    setLoadingPresets(false);
    if ("error" in r) setPresetError(r.error);
    else setPresets(r.presets);
  };

  const openDraft = (key: string | null) => {
    const parts = key ? splitKey(key, names) : { country: "", plan: "" };
    const countryKnown = !parts.country || countries.includes(parts.country);
    const planKnown = !parts.plan || plansFor(parts.country).includes(parts.plan);
    setNotice("");
    setDraft({
      previousKey: key,
      country: parts.country,
      plan: parts.plan,
      countryQ: "",
      planQ: "",
      handCountry: Boolean(parts.country) && !countryKnown,
      handPlan: Boolean(parts.plan) && !planKnown,
      presetName: key ? boundOf(key)?.presetName || "" : "",
    });
    if (!presets && !loadingPresets) void refreshPresets();
  };

  const save = (presetName: string | null) => {
    if (!draft) return;
    const id = shipmentIdentity({ country: draft.country, planName: draft.plan });
    const countryPlans = plansFor(draft.country);
    if (presetName && draft.country && !draft.plan.trim() && countryPlans.length > 0) {
      setNotice("請再點方案名稱。天數寫在方案名稱裡，只選國家對不到出貨。");
      return;
    }
    if (presetName && !id) {
      setNotice("請先點一個國家或方案名稱");
      return;
    }
    const key = id?.key || draft.previousKey;
    if (!key) return;
    setNotice("");
    startSaving(async () => {
      const next = await bindPosPresetAction(key, presetName, draft.previousKey);
      setBindings(next);
      setDraft(null);
      setNotice(presetName ? "已綁定" : "已解除");
    });
  };

  const extraRows: ShipmentName[] = bindings
    .filter((b) => !names.some((n) => n.key === b.key))
    .map((b) => {
      const parts = splitKey(b.key, names);
      return { key: b.key, title: parts.country, subtitle: parts.plan, count: 0 };
    });
  const q = query.trim().toLowerCase();
  const rows = [...names, ...extraRows]
    .map((n) => ({ ...n, binding: boundOf(n.key) }))
    .filter((n) => !q || `${n.title} ${n.subtitle} ${n.binding?.presetName || ""}`.toLowerCase().includes(q))
    .sort((a, b) => Number(!!a.binding) - Number(!!b.binding) || a.title.localeCompare(b.title, "zh-Hant"));

  const draftKey = draft ? shipmentIdentity({ country: draft.country, planName: draft.plan }) : null;
  const countryOptions = draft ? countries.filter((c) => c.toLowerCase().includes(draft.countryQ.trim().toLowerCase())) : [];
  const planOptions = draft
    ? plansFor(draft.country).filter((p) => p.toLowerCase().includes(draft.planQ.trim().toLowerCase()))
    : [];

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜尋已出貨的國家或方案名稱"
            className="min-w-0 flex-1 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm outline-none focus:border-zinc-400 focus:bg-white"
          />
          <button
            type="button"
            onClick={() => openDraft(null)}
            className="rounded-full bg-zinc-900 px-4 py-2 text-xs font-medium text-white"
          >
            新增規則
          </button>
        </div>
        <p className="mt-2 text-[11px] text-zinc-400">只列出已給客人、已給同行的紀錄。方案名稱含天數，不同天數要各綁一條。</p>
        {notice && !draft && <p className="mt-2 text-xs text-emerald-600">{notice}</p>}
        {rows.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-400">還沒有出貨紀錄。出過一次之後，這裡就可以點國家和方案名稱。</p>
        ) : (
          <ul className="mt-3 divide-y divide-zinc-100">
            {rows.map((n) => {
              const preset = n.binding ? presetOf(n.binding.presetName) : undefined;
              const missing = n.binding && presets && !preset;
              return (
                <li key={n.key}>
                  <button type="button" onClick={() => openDraft(n.key)} className="flex w-full items-start justify-between gap-3 py-3 text-left">
                    <span className="min-w-0">
                      <span className="block text-[11px] text-zinc-400">國家</span>
                      <span className="block text-sm font-medium text-zinc-900">{n.title || "—"}</span>
                      <span className="mt-1 block text-[11px] text-zinc-400">方案名稱</span>
                      <span className="block text-sm text-zinc-800">{n.subtitle || "（這筆沒有方案名稱）"}</span>
                      {n.count > 0 && <span className="mt-0.5 block text-[11px] text-zinc-400">出過 {n.count} 張</span>}
                    </span>
                    <span className="shrink-0 pt-4 text-right text-xs">
                      {n.binding ? (
                        <>
                          <span className="block font-medium text-emerald-700">{n.binding.presetName}</span>
                          <span className="mt-0.5 block text-zinc-500">
                            {missing ? "POS 已無此卡" : preset ? (preset.price > 0 ? `$${preset.price}／成本 $${preset.cost}` : `售價現打／成本 $${preset.cost}`) : "點開可改"}
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

      {draft && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={() => !saving && setDraft(null)}>
          <div className="max-h-[88vh] w-full max-w-md overflow-auto rounded-t-2xl bg-white p-4 shadow-xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">{draft.previousKey ? "編輯規則" : "新增規則"}</h2>
              <button type="button" onClick={() => setDraft(null)} className="text-sm text-zinc-500">關閉</button>
            </div>

            <PickBlock
              label="國家（已出貨）"
              query={draft.countryQ}
              onQuery={(countryQ) => setDraft({ ...draft, countryQ })}
              options={countryOptions}
              value={draft.country}
              hand={draft.handCountry}
              onHand={(handCountry) => setDraft({ ...draft, handCountry, country: handCountry ? draft.country : "" })}
              onPick={(country) => setDraft({ ...draft, country, handCountry: false, plan: plansFor(country).includes(draft.plan) ? draft.plan : "" })}
              onType={(country) => setDraft({ ...draft, country })}
            />
            <PickBlock
              label="方案名稱（已出貨，含天數）"
              query={draft.planQ}
              onQuery={(planQ) => setDraft({ ...draft, planQ })}
              options={planOptions}
              value={draft.plan}
              hand={draft.handPlan}
              onHand={(handPlan) => setDraft({ ...draft, handPlan, plan: handPlan ? draft.plan : "" })}
              onPick={(plan) => setDraft({ ...draft, plan, handPlan: false })}
              onType={(plan) => setDraft({ ...draft, plan })}
              emptyHint={draft.country ? "這個國家出過的貨沒有另填方案名稱" : "先點國家，或直接搜尋方案名稱"}
            />
            <p className="mt-2 text-xs text-zinc-500">
              這條會對到：{draftKey ? `${draftKey.title}${draftKey.subtitle ? `／${draftKey.subtitle}` : ""}` : "尚未選擇"}
            </p>

            <div className="mt-4 flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-700">POS 常用卡</span>
              <button type="button" onClick={() => void refreshPresets()} disabled={loadingPresets} className="text-xs text-zinc-600 underline disabled:opacity-50">
                {loadingPresets ? "讀取中…" : "重新讀取"}
              </button>
            </div>
            {presetError && <p className="mt-2 text-xs text-rose-600">{presetError}</p>}
            {!presets && !presetError && <p className="mt-3 text-xs text-zinc-400">讀取中…</p>}
            <div className="mt-2 space-y-2">
              {(presets || []).map((p) => (
                <button
                  key={p.name}
                  type="button"
                  disabled={saving || !draftKey}
                  onClick={() => setDraft({ ...draft, presetName: p.name })}
                  className={`flex w-full items-center justify-between rounded-xl border px-3 py-3 text-left text-sm disabled:opacity-50 ${
                    draft.presetName === p.name ? "border-emerald-500 bg-emerald-50" : "border-zinc-200"
                  }`}
                >
                  <span className="font-medium">{p.name}</span>
                  <span className="text-xs text-zinc-500">{p.price > 0 ? `$${p.price}` : "售價現打"}・成本 ${p.cost}</span>
                </button>
              ))}
            </div>

            <div className="mt-4 flex items-center gap-3">
              <button
                type="button"
                disabled={saving || !draftKey || !draft.presetName}
                onClick={() => save(draft.presetName)}
                className="rounded-full bg-zinc-900 px-4 py-2 text-xs font-medium text-white disabled:opacity-50"
              >
                {saving ? "儲存中…" : "儲存"}
              </button>
              {draft.previousKey && boundOf(draft.previousKey) && (
                <button type="button" disabled={saving} onClick={() => save(null)} className="text-xs text-rose-600 disabled:opacity-50">
                  解除綁定
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PickBlock({
  label,
  query,
  onQuery,
  options,
  value,
  hand,
  onHand,
  onPick,
  onType,
  emptyHint,
}: {
  label: string;
  query: string;
  onQuery: (v: string) => void;
  options: string[];
  value: string;
  hand: boolean;
  onHand: (v: boolean) => void;
  onPick: (v: string) => void;
  onType: (v: string) => void;
  emptyHint?: string;
}) {
  return (
    <div className="mt-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-zinc-700">{label}</span>
        <button type="button" onClick={() => onHand(!hand)} className="text-[11px] text-zinc-500 underline">
          {hand ? "改回點選" : "手打"}
        </button>
      </div>
      {hand ? (
        <input
          value={value}
          onChange={(e) => onType(e.target.value)}
          placeholder="例外才手打"
          className="mt-2 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400"
        />
      ) : (
        <>
          <input
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="搜尋"
            className="mt-2 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm outline-none focus:border-zinc-400"
          />
          {value && <p className="mt-1 text-xs text-emerald-700">已選：{value}</p>}
          <div className="mt-2 max-h-36 space-y-1 overflow-auto">
            {options.length === 0 ? (
              <p className="text-xs text-zinc-400">{emptyHint || "沒有出貨紀錄"}</p>
            ) : (
              options.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => onPick(opt)}
                  className={`block w-full rounded-lg px-3 py-2 text-left text-sm ${opt === value ? "bg-emerald-50 text-emerald-800" : "hover:bg-zinc-50"}`}
                >
                  {opt}
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
