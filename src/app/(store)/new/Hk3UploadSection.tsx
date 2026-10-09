"use client";

import { useActionState, useState } from "react";
import CopyPhonesBox from "../CopyPhonesBox";
import { importHk3Screenshots, type Hk3ImportResult } from "../hk3Actions";

export default function Hk3UploadSection() {
  const [result, formAction, pending] = useActionState<Hk3ImportResult | null, FormData>(
    importHk3Screenshots,
    null,
  );
  const [count, setCount] = useState(0);
  const [formKey, setFormKey] = useState(0);
  const [dismissed, setDismissed] = useState<Hk3ImportResult | null>(null);
  const showResult = result && result !== dismissed;
  const closeResult = () => {
    setDismissed(result);
    setCount(0);
    setFormKey((k) => k + 1);
  };

  return (
    <>
      <p className="text-xs text-zinc-500">
        一張截圖一張卡（要拍到門號、ICCID 和 QR）。系統會自動辨識門號，到 3HK 查詢是否已開通，只有全新未開通、且沒入過庫的卡才會入庫。
      </p>

      <form key={formKey} action={formAction} className="mt-4 space-y-4">
        <label className="block cursor-pointer rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-3 py-6 text-center text-xs text-zinc-500 hover:border-zinc-400 hover:bg-zinc-100">
          <input
            name="screenshots"
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => setCount(e.target.files?.length ?? 0)}
          />
          {count > 0 ? `已選 ${count} 張截圖，點此更換` : "點此選擇台灣卡截圖"}
        </label>
        <button
          type="submit"
          disabled={pending || count === 0}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              辨識並查詢中，每張約 1～3 秒，請勿離開…
            </>
          ) : (
            "辨識、查開通並入庫"
          )}
        </button>
      </form>

      {showResult && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          onClick={closeResult}
        >
          <div
            className="max-h-[85vh] w-full max-w-md space-y-4 overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-base font-semibold text-zinc-800">
              入庫 {result.imported.length} 張
              {result.activated.length + result.duplicate.length + result.failed.length > 0 &&
                `，擋下 ${result.activated.length + result.duplicate.length + result.failed.length} 張`}
            </p>

            {result.activated.length > 0 && (
              <div className="space-y-2 rounded-xl border border-rose-200 p-3">
                <p className="text-sm font-medium text-rose-700">
                  ⚠️ 已被開通，沒有入庫（{result.activated.length} 張）
                </p>
                <ul className="space-y-0.5 text-xs text-zinc-600">
                  {result.activated.map((a) => (
                    <li key={a.file}>
                      {a.phone}・狀態 {a.status}
                      {a.activatedAt && `・激活於 ${a.activatedAt.replace("T", " ").slice(0, 16)}`}
                    </li>
                  ))}
                </ul>
                <CopyPhonesBox title="門號（可直接貼給廠商）" phones={result.activated.map((a) => a.phone)} />
              </div>
            )}

            {result.duplicate.length > 0 && (
              <div className="space-y-2 rounded-xl border border-amber-200 p-3">
                <p className="text-sm font-medium text-amber-700">
                  以前入過庫，廠商重複給（{result.duplicate.length} 張）
                </p>
                <CopyPhonesBox title="門號" phones={result.duplicate.map((d) => d.phone)} />
              </div>
            )}

            {result.failed.length > 0 && (
              <div className="space-y-1 rounded-xl border border-zinc-200 p-3">
                <p className="text-sm font-medium text-zinc-700">
                  需要人工確認（{result.failed.length} 張）
                </p>
                <ul className="space-y-0.5 text-xs text-zinc-600">
                  {result.failed.map((f, i) => (
                    <li key={`${f.file}-${i}`}>
                      {f.file}：{f.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {result.imported.length > 0 && (
              <div className="space-y-1 rounded-xl border border-emerald-200 p-3">
                <p className="text-sm font-medium text-emerald-700">
                  ✓ 全新未開通，已入庫（{result.imported.length} 張）
                </p>
                <ul className="space-y-0.5 text-xs text-zinc-600">
                  {result.imported.map((i) => (
                    <li key={i.phone}>
                      {i.phone}・{i.planName ?? "台灣卡"}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <button
              type="button"
              onClick={closeResult}
              className="w-full rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
            >
              確定
            </button>
          </div>
        </div>
      )}
    </>
  );
}
