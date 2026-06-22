"use client";

import { useState } from "react";
import type { EsimRow } from "@/lib/db";

type ShareConsentGateProps = {
  esims: EsimRow[];
  idsRaw: string;
  sig: string;
};

type GateMode = "pending" | "submitting" | "agreed" | "declined";

export default function ShareConsentGate({
  esims,
  idsRaw,
  sig,
}: ShareConsentGateProps) {
  const [mode, setMode] = useState<GateMode>("pending");

  async function submitDecision(decision: "agree" | "decline") {
    setMode("submitting");
    try {
      const res = await fetch("/api/share/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: idsRaw,
          sig,
          decision,
        }),
      });
      if (!res.ok) {
        throw new Error("failed");
      }
      setMode(decision === "agree" ? "agreed" : "declined");
    } catch {
      setMode("pending");
      window.alert("系統忙碌，請稍後再試。");
    }
  }

  if (mode === "declined") {
    return (
      <div className="min-h-screen bg-zinc-50 px-4 py-8 font-sans text-zinc-900">
        <div className="mx-auto max-w-3xl rounded-2xl border border-zinc-200 bg-white p-6 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-zinc-800">未同意法律聲明</h1>
          <p className="mt-2 text-sm text-zinc-600">
            你已選擇不同意，無法查看 eSIM QR 內容。
          </p>
          <button
            type="button"
            onClick={() => setMode("pending")}
            className="mt-4 rounded-full border border-zinc-300 bg-white px-4 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
          >
            返回聲明頁
          </button>
        </div>
      </div>
    );
  }

  if (mode !== "agreed") {
    const busy = mode === "submitting";
    return (
      <div className="min-h-screen bg-zinc-50 px-4 py-8 font-sans text-zinc-900">
        <div className="mx-auto max-w-3xl rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h1 className="text-lg font-semibold tracking-tight text-zinc-900">
            國際漫遊數據卡（eSIM）服務使用切結暨法律聲明
          </h1>
          <div className="mt-4 space-y-3 text-sm leading-6 text-zinc-700">
            <p>
              本店（以下簡稱「本公司」）所販售之各國 eSIM／國際上網數據卡（以下簡稱「本商品」），僅提供消費者於跨境旅遊、商務出差時之「合法數據漫遊上網」使用。為保障雙方權益並維護電信安全，購買者（以下簡稱「甲方」）同意並承諾以下條款：
            </p>
            <p>
              實名制與防詐義務：甲方購買本商品時，須保證所提供之身分資料（或護照資訊）皆為真實且合法取得。甲方承諾本商品僅供本人或合法授權之隨行親友使用，絕對不得將本商品轉售、轉租、質押或提供予任何不特定第三人非法使用。
            </p>
            <p>
              禁止非法用途：甲方嚴禁利用本商品從事電信詐欺、洗錢、架設非法機房（SIM Box）、非法網路刺探、妨害電腦使用罪、散佈非法訊息，或任何違反中華民國法令及目的地國家電信法規之行為。
            </p>
            <p>
              免責與追索聲明：本商品一經交付、開通或交付 QR Code
              序號後，其通訊行為皆屬甲方之個人行為。如因甲方非法使用（如從事詐騙、遭治安機關標記）導致該電信卡片或相關漫遊電信網路遭強制斷網、停話、沒收，本公司概不負責、亦不退還任何款項。若甲方之使用行為導致本公司涉入刑事偵查、配合司法機關調查，或導致本公司之電信商通路信用受損、財產損失，本公司將依法追究甲方所有法律責任，並請求全額損害賠償。
            </p>
            <p>
              售後服務界線：本商品屬於一次性跨境電信漫遊商品，網路速度與連線品質受限於目的地國家當地電信業者（如
              Softbank, Docomo, AT&T
              等）之基地台覆蓋率與漫遊公平使用原則（FUP）。本公司僅負責交付合法可用之序號，不提供異地現場網路故障排除、斷線排查等技術長尾維護服務。
            </p>
            <p className="font-medium text-zinc-900">
              購買人一經付款或掃描 QR Code，即視為完全同意並接受上述所有條款。
            </p>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => submitDecision("agree")}
              className="rounded-full bg-zinc-900 px-4 py-2 text-xs font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
            >
              {busy ? "處理中..." : "同意並繼續"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => submitDecision("decline")}
              className="rounded-full border border-zinc-300 bg-white px-4 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:text-zinc-400"
            >
              不同意
            </button>
          </div>
          <p className="mt-2 text-[11px] text-zinc-500">
            每次開啟分享連結都需重新確認本聲明。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 px-4 py-8 font-sans text-zinc-900">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <header className="text-center">
          <h1 className="text-xl font-semibold tracking-tight">
            eSIM QR 一覽
          </h1>
          <p className="mt-1 text-xs text-zinc-500">
            這個頁面會顯示多張 eSIM 的 QR 圖片，方便一次給同一位客人或同行。
          </p>
        </header>

        <div className="grid gap-4">
          {esims.map((esim) => (
            <div
              key={esim.id}
              className="rounded-2xl border border-zinc-200 bg-white p-4"
            >
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <div className="text-xs font-medium text-zinc-800">
                    {esim.country || "未命名方案"}
                  </div>
                  <div className="text-[11px] text-zinc-500">
                    {esim.planName || "—"}（ID #{esim.id}）
                  </div>
                </div>
              </div>
              {esim.qrPath ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={esim.qrPath}
                  alt={`eSIM QR #${esim.id}`}
                  className="mx-auto h-auto max-h-[360px] w-auto max-w-full rounded-lg border border-zinc-200 bg-white object-contain"
                />
              ) : (
                <p className="text-center text-xs text-zinc-400">
                  這筆 eSIM 沒有對應的 QR 圖片。
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

