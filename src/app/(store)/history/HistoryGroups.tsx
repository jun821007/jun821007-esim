"use client";

import { useState } from "react";
import type { EsimRow } from "@/lib/db";
import RevertButton from "./RevertButton";

type HistoryGroupsProps = {
  history: EsimRow[];
  revertAction: (formData: FormData) => Promise<void>;
};

function statusLabel(status: string): string {
  switch (status) {
    case "UNUSED":
      return "未使用";
    case "CUSTOMER":
      return "已給客人";
    case "PEER":
      return "已給同行";
    case "VOID":
      return "作廢";
    default:
      return status;
  }
}

function copyToClipboard(text: string): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard
      .writeText(text)
      .then(() => true)
      .catch(() => false);
  }
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  const ok = document.execCommand("copy");
  document.body.removeChild(ta);
  return Promise.resolve(ok);
}

export default function HistoryGroups({
  history,
  revertAction,
}: HistoryGroupsProps) {
  // 同一個人（customerName）分組，未填的放「未填名稱」
  const list = Array.isArray(history) ? history : [];
  const groups = list.reduce<Record<string, EsimRow[]>>((acc, esim) => {
    const key = esim.customerName?.trim() || "未填名稱";
    if (!acc[key]) acc[key] = [];
    acc[key].push(esim);
    return acc;
  }, {});

  const groupKeys = Object.keys(groups).sort((a, b) => {
    const aFirst = groups[a]?.[0]?.createdAt ?? "";
    const bFirst = groups[b]?.[0]?.createdAt ?? "";
    return bFirst.localeCompare(aFirst);
  });

  if (groupKeys.length === 0) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white px-6 py-8 text-center text-xs text-zinc-400">
        暫時沒有任何歷史紀錄。
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {groupKeys.map((key) => {
        const items = Array.isArray(groups[key]) ? groups[key] : [];
        const ids = items.map((e) => e.id).join(",");
        return (
          <GroupSection
            key={key}
            title={key}
            items={items}
            ids={ids}
            revertAction={revertAction}
          />
        );
      })}
    </div>
  );
}

function GroupSection({
  title,
  items,
  ids,
  revertAction,
}: {
  title: string;
  items: EsimRow[];
  ids: string;
  revertAction: (formData: FormData) => Promise<void>;
}) {
  const [open, setOpen] = useState(true);
  const [copySuccess, setCopySuccess] = useState(false);
  const sharePath = `/share?ids=${ids}`;
  const fullShareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}${sharePath}`
      : sharePath;

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <div
        className="flex cursor-pointer items-center justify-between gap-2 px-4 py-3 text-left"
        onClick={() => setOpen((o) => !o)}
      >
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-zinc-800">{title}</span>
          <span className="text-xs text-zinc-500">
            共 {items.length} 筆
          </span>
          {open && (
            <a
              href={sharePath}
              target="_blank"
              rel="noreferrer"
              className="rounded-full bg-sky-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-sky-700"
              onClick={(e) => e.stopPropagation()}
            >
              開啟分享連結
            </a>
          )}
          {open && (
            <button
              type="button"
              className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                copySuccess
                  ? "bg-emerald-600 text-white"
                  : "border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
              }`}
              onClick={(e) => {
                e.stopPropagation();
                copyToClipboard(fullShareUrl).then((ok) => {
                  if (ok) {
                    setCopySuccess(true);
                    setTimeout(() => setCopySuccess(false), 2000);
                  }
                });
              }}
            >
              {copySuccess ? "✓ 已複製" : "複製連結"}
            </button>
          )}
        </div>
        <span className="text-zinc-400">{open ? "▲" : "▼"}</span>
      </div>

      {open && (
        <div className="border-t border-zinc-100">
          <div className="max-h-[400px] overflow-auto">
            <table className="min-w-full text-left text-xs">
              <thead className="sticky top-0 bg-zinc-50 text-[11px] uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-3 py-2 font-medium">ID</th>
                  <th className="px-3 py-2 font-medium">方案</th>
                  <th className="px-3 py-2 font-medium">狀態</th>
                  <th className="px-3 py-2 font-medium">備註</th>
                  <th className="px-3 py-2 font-medium">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 text-[11px]">
                {items.map((esim) => (
                  <tr key={esim.id} className="align-top">
                    <td className="whitespace-nowrap px-3 py-3 text-zinc-500">
                      #{esim.id}
                    </td>
                    <td className="px-3 py-3">
                      <div className="text-xs font-medium text-zinc-800">
                        {esim.country || "—"}
                      </div>
                      <div className="mt-0.5 text-[11px] text-zinc-500">
                        {esim.planName || "—"}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span className="inline-flex rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-700">
                        {statusLabel(esim.status)}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-[11px] text-zinc-600">
                      {esim.notes || "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3">
                      <RevertButton esimId={esim.id} action={revertAction} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
