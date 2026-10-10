"use client";

import { useTransition } from "react";

export type RevertResult = { ok: true } | { ok: false; error: string };

type RevertButtonProps = {
  esimId: number;
  posOrderId?: string | null;
  action: (id: number) => Promise<RevertResult>;
};

export default function RevertButton({ esimId, posOrderId, action }: RevertButtonProps) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        const posNote = posOrderId
          ? `\n\n這張已掛帳到 POS（單號 ${posOrderId}），會一併從 POS 未結單刪除。`
          : "";
        if (!window.confirm(`確定要將 #${esimId} 衝正並回補庫存？${posNote}`)) return;
        startTransition(async () => {
          const r = await action(esimId).catch(
            (e: unknown): RevertResult => ({ ok: false, error: String(e) }),
          );
          if (!r.ok) window.alert(`衝正沒有執行：${r.error}`);
        });
      }}
      className="rounded-full border border-emerald-400 bg-white px-2.5 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-60"
    >
      {pending ? "衝正中…" : "衝正"}
    </button>
  );
}
