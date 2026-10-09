"use client";

import { useState } from "react";

async function copyText(text: string): Promise<boolean> {
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
  return ok;
}

export default function CopyPhonesBox({ title, phones }: { title: string; phones: string[] }) {
  const [copied, setCopied] = useState(false);
  const text = phones.join("\n");

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-rose-700">{title}</span>
        <button
          type="button"
          onClick={() =>
            copyText(text).then((ok) => {
              if (!ok) return window.alert("複製失敗，請手動選取複製");
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            })
          }
          className={`rounded-full px-3 py-1 text-xs font-medium text-white transition-colors ${
            copied ? "bg-emerald-600" : "bg-zinc-900 hover:bg-zinc-800"
          }`}
        >
          {copied ? "✓ 已複製" : "複製門號"}
        </button>
      </div>
      <textarea
        readOnly
        value={text}
        rows={Math.min(8, Math.max(2, phones.length))}
        onFocus={(e) => e.currentTarget.select()}
        className="w-full rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 font-mono text-sm text-zinc-800 outline-none"
      />
    </div>
  );
}
