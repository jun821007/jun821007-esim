"use client";

import { useFormStatus } from "react-dom";
import { useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";

export function QrUploadSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <>
      {pending && (
        <div className="h-1 w-full overflow-hidden rounded-full bg-zinc-200">
          <div className="h-full w-full animate-pulse bg-zinc-500" />
        </div>
      )}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-70 hover:bg-zinc-800 active:bg-zinc-950 disabled:hover:bg-zinc-900"
      >
        {pending ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            上傳中，請勿重複按...
          </>
        ) : (
          "依圖片批量入庫"
        )}
      </button>
    </>
  );
}

export function UploadedModal() {
  const searchParams = useSearchParams();
  const uploaded = searchParams.get("uploaded");
  const count = uploaded ? Number(uploaded) : 0;
  const [open, setOpen] = useState(count > 0);

  const close = useCallback(() => {
    setOpen(false);
    window.history.replaceState(null, "", "/new");
  }, []);

  if (!open || count <= 0) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      onClick={close}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-center text-base font-medium text-zinc-800">
          上傳完成，已入庫 {count} 筆
        </p>
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={close}
            className="rounded-full bg-zinc-900 px-6 py-2 text-sm font-medium text-white hover:bg-zinc-800"
          >
            確定
          </button>
        </div>
      </div>
    </div>
  );
}

export function CollapsibleSection({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-zinc-700"
      >
        {title}
        <span className="text-zinc-400">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="overflow-visible border-t border-zinc-100 px-4 pb-4 pt-2">
          {children}
        </div>
      )}
    </div>
  );
}
