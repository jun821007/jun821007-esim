"use client";

import { useFormStatus } from "react-dom";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

export function QrFileInputWithPreview() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previews, setPreviews] = useState<string[]>([]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) {
      setPreviews([]);
      return;
    }
    const urls = Array.from(files)
      .filter((f) => f.type.startsWith("image/"))
      .slice(0, 20)
      .map((f) => URL.createObjectURL(f));
    setPreviews((prev) => {
      prev.forEach((u) => URL.revokeObjectURL(u));
      return urls;
    });
  }, []);

  useEffect(
    () => () => {
      previews.forEach((u) => URL.revokeObjectURL(u));
    },
    [previews]
  );

  return (
    <div className="space-y-2">
      <label className="block cursor-pointer rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-3 py-6 text-center text-xs text-zinc-500 hover:border-zinc-400 hover:bg-zinc-100">
        <input
          ref={inputRef}
          name="qrFiles"
          type="file"
          accept="image/*"
          multiple
          onChange={handleChange}
          className="hidden"
        />
        {previews.length > 0
          ? `已選 ${previews.length} 張，點此更換`
          : "點此選擇 QR 圖片"}
      </label>
      {previews.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {previews.map((url, i) => (
            <img
              key={url}
              src={url}
              alt=""
              className="h-14 w-14 rounded-lg border border-zinc-200 object-cover"
            />
          ))}
        </div>
      )}
    </div>
  );
}

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
            上傳中，請勿重複按…
          </>
        ) : (
          "依方案批量入庫"
        )}
      </button>
    </>
  );
}

export function ShareLinkSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <>
      {pending && (
        <div className="h-1 w-full overflow-hidden rounded-full bg-zinc-200">
          <div className="h-full w-full animate-pulse bg-sky-500" />
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
            入庫中，請勿重複按…
          </>
        ) : (
          "批量入庫"
        )}
      </button>
    </>
  );
}

export function UploadedModal() {
  const searchParams = useSearchParams();
  const uploaded = searchParams?.get?.("uploaded") ?? null;
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

export function UploadErrorModal() {
  const searchParams = useSearchParams();
  const error = searchParams?.get?.("error") ?? null;
  const [open, setOpen] = useState(error === "upload");

  const close = useCallback(() => {
    setOpen(false);
    window.history.replaceState(null, "", "/new");
  }, []);

  if (!open || error !== "upload") return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      onClick={close}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-rose-200 bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-center text-base font-medium text-rose-700">
          上傳失敗，請稍後再試或改用「方式三」貼上 QR 網址入庫
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
        <span className="text-zinc-400">{open ? "▼" : "▶"}</span>
      </button>
      {open && (
        <div className="overflow-visible border-t border-zinc-100 px-4 pb-4 pt-2">
          {children}
        </div>
      )}
    </div>
  );
}
