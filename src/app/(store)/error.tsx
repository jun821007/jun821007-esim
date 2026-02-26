"use client";

import { useEffect } from "react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-zinc-950 px-4 text-white">
      <h2 className="text-lg font-medium">發生錯誤</h2>
      <p className="max-w-sm text-center text-sm text-zinc-400">
        頁面載入時發生問題，請稍後再試或返回首頁。
      </p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-full bg-white px-6 py-2.5 text-sm font-medium text-zinc-900"
        >
          再試一次
        </button>
        <a
          href="/"
          className="rounded-full border border-zinc-600 px-6 py-2.5 text-sm font-medium"
        >
          返回首頁
        </a>
      </div>
    </div>
  );
}