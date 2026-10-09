"use client";

import { useRef } from "react";

type RevertButtonProps = {
  esimId: number;
  posOrderId?: string | null;
  action: (formData: FormData) => Promise<void>;
};

export default function RevertButton({ esimId, posOrderId, action }: RevertButtonProps) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={action} className="inline">
      <input type="hidden" name="id" value={esimId} />
      <button
        type="button"
        onClick={() => {
          const posNote = posOrderId
            ? `\n\n這張已掛帳到 POS（單號 ${posOrderId}），衝正後請到 POS 把那筆刪掉。`
            : "";
          if (window.confirm(`確定要將 #${esimId} 衝正並回補庫存？${posNote}`)) {
            formRef.current?.requestSubmit();
          }
        }}
        className="rounded-full border border-emerald-400 bg-white px-2.5 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-50"
      >
        衝正
      </button>
    </form>
  );
}
