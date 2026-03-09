"use client";

import { useTransition } from "react";

type Props = {
  storeId: number;
  storeName: string;
  onDelete: (storeId: number) => Promise<void>;
};

export default function AdminDeleteStoreButton({
  storeId,
  storeName,
  onDelete,
}: Props) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!window.confirm(`確定要刪除店家「${storeName}」？此動作會刪除該店家的所有 eSIM 紀錄且無法復原。`)) return;
        startTransition(async () => {
          await onDelete(storeId);
        });
      }}
      className="text-xs text-rose-600 underline hover:text-rose-700 disabled:opacity-50"
    >
      {pending ? "刪除中…" : "刪除帳號"}
    </button>
  );
}
