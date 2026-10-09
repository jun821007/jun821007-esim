"use client";

import { useActionState, useState } from "react";
import CopyPhonesBox from "../CopyPhonesBox";
import { uploadQrImages, type ImageUploadResult } from "../hk3Actions";
import { QrFileInputWithPreview } from "./NewPageClient";

const inputClass =
  "w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm outline-none ring-0 transition focus:border-zinc-400 focus:bg-white";

export default function ImageUploadSection() {
  const [result, formAction, pending] = useActionState<ImageUploadResult | null, FormData>(
    uploadQrImages,
    null,
  );
  const [country, setCountry] = useState("");
  const [formKey, setFormKey] = useState(0);
  const [dismissed, setDismissed] = useState<ImageUploadResult | null>(null);
  const isTaiwan = /台灣|臺灣|taiwan/i.test(country);
  const showResult = result && result !== dismissed;

  const closeResult = () => {
    setDismissed(result);
    if (result?.kind !== "error") {
      setCountry("");
      setFormKey((k) => k + 1);
    }
  };

  return (
    <>
      <p className="text-xs text-zinc-500">
        一次選多張 QR 圖片，系統會自動依方案資訊分別建立多筆 eSIM。
      </p>

      <form key={formKey} action={formAction} className="mt-4 space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-zinc-600">國家 / 區域</label>
            <input
              name="country"
              type="text"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className={inputClass}
              placeholder="例如：日本、歐洲多國"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-zinc-600">方案名稱</label>
            <input
              name="planName"
              type="text"
              className={inputClass}
              placeholder={isTaiwan ? "台灣卡可留空，自動帶 3HK 方案名稱" : "例如：10 天 20GB"}
            />
          </div>
        </div>

        {isTaiwan && (
          <p className="rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-800">
            台灣卡會自動辨識截圖上的門號，到 3HK 查詢是否已開通。只有全新未開通、且沒入過庫的卡才會入庫；截圖要拍到左邊的門號、ICCID 和 QR。
          </p>
        )}

        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-zinc-600">備註</label>
          <textarea
            name="notes"
            rows={2}
            className={inputClass}
            placeholder="例如：這批是 A 廠商，含語音 / 特殊限制等"
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-zinc-600">QR 圖片（可多選）</label>
          <QrFileInputWithPreview />
          <p className="text-[10px] text-zinc-400">
            一次選多張 QR 圖，系統會依照上面的方案資訊自動建立多筆 eSIM。
          </p>
        </div>

        {pending && (
          <div className="h-1 w-full overflow-hidden rounded-full bg-zinc-200">
            <div className="h-full w-full animate-pulse bg-zinc-500" />
          </div>
        )}
        <button
          type="submit"
          disabled={pending}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 active:bg-zinc-950 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {pending ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              {isTaiwan ? "辨識並查詢開通中，每張約 1～3 秒…" : "上傳中，請勿重複按…"}
            </>
          ) : isTaiwan ? (
            "辨識、查開通並入庫"
          ) : (
            "依方案批量入庫"
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
            {result.kind === "error" && (
              <p className="text-center text-base font-medium text-rose-700">
                上傳失敗，請稍後再試
              </p>
            )}
            {result.kind === "normal" && (
              <p className="text-center text-base font-medium text-zinc-800">
                上傳完成，已入庫 {result.count} 筆
              </p>
            )}
            {result.kind === "hk3" && <Hk3Result result={result} />}

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

function Hk3Result({ result }: { result: Extract<ImageUploadResult, { kind: "hk3" }> }) {
  const blocked = result.activated.length + result.duplicate.length + result.failed.length;
  return (
    <>
      <p className="text-base font-semibold text-zinc-800">
        入庫 {result.imported.length} 張{blocked > 0 && `，擋下 ${blocked} 張`}
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
          <p className="text-sm font-medium text-zinc-700">需要人工確認（{result.failed.length} 張）</p>
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
    </>
  );
}
