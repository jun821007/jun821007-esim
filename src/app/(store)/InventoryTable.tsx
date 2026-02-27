"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { EsimRow, EsimStatus } from "@/lib/db";

type InventoryTableProps = {
  inStock: EsimRow[];
  history: EsimRow[];
  updateEsim: (formData: FormData) => Promise<void>;
  bulkUpdateStatus: (formData: FormData) => Promise<void>;
  bulkDelete: (formData: FormData) => Promise<void>;
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
    return navigator.clipboard.writeText(text).then(() => true).catch(() => false);
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

function statusClassName(status: string): string {
  switch (status) {
    case "UNUSED":
      return "bg-emerald-100 text-emerald-800";
    case "CUSTOMER":
      return "bg-amber-100 text-amber-800";
    case "PEER":
      return "bg-sky-100 text-sky-800";
    case "VOID":
      return "bg-rose-100 text-rose-800";
    default:
      return "bg-zinc-100 text-zinc-800";
  }
}

export default function InventoryTable({
  inStock,
  history,
  updateEsim,
  bulkUpdateStatus,
  bulkDelete,
}: InventoryTableProps) {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Auto-clear selection after server revalidation (inStock ids change)
  // Only close modal if still on step 1 (step 2 = user is copying share URL)
  const inStockKey = inStock.map(e => e.id).join(",");
  const prevKeyRef = useRef(inStockKey);
  useEffect(() => {
    if (inStockKey !== prevKeyRef.current) {
      prevKeyRef.current = inStockKey;
      setSelectedIds(new Set());
      // Only auto-close if user hasn't reached step 2 (share URL screen)
      setMarkModalStep((prev) => {
        if (prev === 1) setMarkModalOpen(false);
        return 1;
      });
    }
  }, [inStockKey]);

  const allSelected = useMemo(
    () => inStock.length > 0 && selectedIds.size === inStock.length,
    [inStock.length, selectedIds],
  );

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(inStock.map((e) => e.id)));
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectedIdsValue = useMemo(
    () => Array.from(selectedIds).join(","),
    [selectedIds],
  );

  const disabledBulk = selectedIds.size === 0;

  const shareUrl =
    selectedIds.size > 0
      ? `/share?ids=${Array.from(selectedIds).join(",")}`
      : "#";

  const [fullShareUrl, setFullShareUrl] = useState("");
  useEffect(() => {
    if (typeof window !== "undefined" && selectedIds.size > 0) {
      setFullShareUrl(`${window.location.origin}${shareUrl}`);
    } else {
      setFullShareUrl("");
    }
  }, [selectedIds, shareUrl]);

  const [markModalOpen, setMarkModalOpen] = useState(false);
  const [markModalStep, setMarkModalStep] = useState<1 | 2>(1);
  const deleteFormRef = useRef<HTMLFormElement>(null);
  const [pendingStatus, setPendingStatus] = useState<"CUSTOMER" | "PEER" | "VOID">("CUSTOMER");
  const [pendingCustomerName, setPendingCustomerName] = useState("");
  const [copySuccess, setCopySuccess] = useState(false);

  return (
    <div className="space-y-8">
      {/* 批量出貨：先選客人/同行+填名稱，確定後再給網址 */}
      {selectedIds.size > 0 && (
        <div className="rounded-xl border-2 border-zinc-300 bg-amber-50 px-4 py-3">
          <p className="mb-2 text-sm font-medium text-amber-900">
            已選 <span className="text-lg font-bold">{selectedIds.size}</span> 張
            · 批量出貨
          </p>
          <button
            type="button"
            onClick={() => {
              setMarkModalStep(1);
              setPendingStatus("CUSTOMER");
              setPendingCustomerName("");
              setMarkModalOpen(true);
            }}
            className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
          >
            批量出貨
          </button>
          {markModalOpen && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
              onClick={() => {
                setMarkModalOpen(false);
                setMarkModalStep(1);
                setPendingStatus("CUSTOMER");
                setPendingCustomerName("");
                setSelectedIds(new Set());
                setCopySuccess(false);
              }}
            >
              <div
                className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <form action={bulkUpdateStatus} className="space-y-4">
                  <input type="hidden" name="ids" value={selectedIdsValue} />
                  <input type="hidden" name="status" value={pendingStatus} />
                  <input
                    type="hidden"
                    name="customerName"
                    value={pendingCustomerName}
                  />
                  {markModalStep === 1 ? (
                    <>
                      <p className="text-sm font-medium text-zinc-800">
                        步驟一：選擇客人／同行、填名稱
                      </p>
                      <div>
                        <span className="block text-xs text-zinc-600">狀態</span>
                        <div className="mt-1 flex gap-2">
                          <label className="flex cursor-pointer items-center gap-1.5">
                            <input
                              type="radio"
                              value="CUSTOMER"
                              checked={pendingStatus === "CUSTOMER"}
                              onChange={() => setPendingStatus("CUSTOMER")}
                            />
                            <span className="text-xs">客人</span>
                          </label>
                          <label className="flex cursor-pointer items-center gap-1.5">
                            <input
                              type="radio"
                              value="PEER"
                              checked={pendingStatus === "PEER"}
                              onChange={() => setPendingStatus("PEER")}
                            />
                            <span className="text-xs">同行</span>
                          </label>
                          <label className="flex cursor-pointer items-center gap-1.5">
                            <input
                              type="radio"
                              value="VOID"
                              checked={pendingStatus === "VOID"}
                              onChange={() => setPendingStatus("VOID")}
                            />
                            <span className="text-xs">作廢</span>
                          </label>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs text-zinc-600">
                          客戶／同行名稱（選填）
                        </label>
                        <input
                          type="text"
                          placeholder="例如：王小明"
                          value={pendingCustomerName}
                          onChange={(e) =>
                            setPendingCustomerName(e.target.value)
                          }
                          className="mt-1 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm outline-none focus:border-zinc-400 focus:bg-white"
                        />
                      </div>
                      <div className="flex gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => {
                            setMarkModalOpen(false);
                            setMarkModalStep(1);
                            setPendingStatus("CUSTOMER");
                            setPendingCustomerName("");
                            setSelectedIds(new Set());
                            setCopySuccess(false);
                          }}
                          className="flex-1 rounded-full border border-zinc-300 bg-white px-4 py-2 text-xs font-medium text-zinc-700"
                        >
                          取消
                        </button>
                        <button
                          type="submit"
                          onClick={() => {
                            requestAnimationFrame(() =>
                              setMarkModalStep(2)
                            );
                          }}
                          className="flex-1 rounded-full bg-zinc-900 px-4 py-2 text-xs font-medium text-white hover:bg-zinc-800"
                        >
                          確定
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-medium text-zinc-800">
                        步驟二：分享連結
                      </p>
                      <div className="flex flex-wrap items-center gap-2 rounded-lg bg-zinc-50 px-3 py-2">
                        <span className="truncate text-xs text-zinc-700">
                          {fullShareUrl || shareUrl}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const url =
                              fullShareUrl ||
                              (typeof window !== "undefined"
                                ? `${window.location.origin}${shareUrl}`
                                : shareUrl);
                            copyToClipboard(url).then((ok) => {
                              if (ok) {
                                setCopySuccess(true);
                                setTimeout(() => setCopySuccess(false), 2000);
                              } else {
                                window.alert("複製失敗，請手動複製網址");
                              }
                            });
                          }}
                          className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                            copySuccess
                              ? "bg-emerald-600 text-white"
                              : "bg-zinc-900 text-white hover:bg-zinc-800"
                          }`}
                        >
                          {copySuccess ? "✓ 已複製" : "複製"}
                        </button>
                        <a
                          href={shareUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                        >
                          開啟
                        </a>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setMarkModalOpen(false);
                          setMarkModalStep(1);
                          setPendingStatus("CUSTOMER");
                          setPendingCustomerName("");
                          setSelectedIds(new Set());
                        }}
                        className="w-full rounded-full border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                      >
                        關閉
                      </button>
                    </>
                  )}
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-medium text-zinc-700">
              庫存現貨（未使用，共 {inStock.length} 張）
            </h2>
            <p className="mt-1 text-[11px] text-zinc-500">
              勾選張數 → 按「批量出貨」選狀態、填名稱 → 確定後取得分享連結
            </p>
          </div>
          <form ref={deleteFormRef} action={bulkDelete} className="inline">
            <input type="hidden" name="ids" value={selectedIdsValue} />
            <button
              type="button"
              onClick={() => {
                if (
                  window.confirm(
                    `確定要刪除選取的 ${selectedIds.size} 筆 eSIM？此動作無法復原。`
                  )
                ) {
                  deleteFormRef.current?.requestSubmit();
                }
              }}
              disabled={disabledBulk}
              className="rounded-full border border-rose-300 bg-white px-3 py-1.5 text-[11px] font-medium text-rose-700 disabled:cursor-not-allowed disabled:border-zinc-200 disabled:text-zinc-300"
            >
              刪除選取
            </button>
          </form>
        </div>

        {/* 桌機：表格檢視 */}
        <div className="hidden overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm md:block">
          <div className="max-h-[560px] overflow-auto">
            <table className="min-w-full text-left text-xs">
              <thead className="sticky top-0 bg-zinc-50 text-[11px] uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th className="px-3 py-2 font-medium">ID</th>
                  <th className="px-3 py-2 font-medium">方案</th>
                  <th className="px-3 py-2 font-medium">狀態</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 text-[11px]">
                {inStock.map((esim) => (
                  <tr key={esim.id} className="align-top">
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(esim.id)}
                        onChange={() => toggleSelect(esim.id)}
                      />
                    </td>
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
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${statusClassName(
                          esim.status,
                        )}`}
                      >
                        {statusLabel(esim.status)}
                      </span>
                    </td>
                  </tr>
                ))}
                {inStock.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-3 py-6 text-center text-xs text-zinc-400"
                    >
                      目前沒有任何「未使用」的 eSIM，可以到右上角「新增 / 入庫」新增。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 手機、平板：收折卡片檢視 */}
        <div className="space-y-2 md:hidden">
          {inStock.length > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleSelectAll}
              />
              <span className="text-xs text-zinc-600">
                {allSelected ? "全不選" : "全選"}
              </span>
            </div>
          )}
          {inStock.map((esim) => {
            return (
              <div
                key={esim.id}
                className="rounded-2xl border border-zinc-200 bg-white p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(esim.id)}
                      onChange={() => toggleSelect(esim.id)}
                    />
                    <div>
                      <div className="text-xs font-semibold text-zinc-800">
                        {esim.country || "—"}
                      </div>
                      <div className="text-[11px] text-zinc-500">
                        {esim.planName || "—"}
                      </div>
                    </div>
                  </div>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${statusClassName(
                      esim.status,
                    )}`}
                  >
                    {statusLabel(esim.status)}
                  </span>
                </div>
              </div>
            );
          })}
          {inStock.length === 0 && (
            <p className="px-1 py-4 text-center text-xs text-zinc-400">
              目前沒有任何「未使用」的 eSIM，可以到右上角「新增 / 入庫」新增。
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
