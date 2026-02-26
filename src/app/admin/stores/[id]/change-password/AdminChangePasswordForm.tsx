"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  storeId: number;
  storeName: string;
  action: (
    prev: { ok: boolean; error?: string } | null,
    formData: FormData,
  ) => Promise<{ ok: boolean; error?: string }>;
};

export default function AdminChangePasswordForm({ storeId, storeName, action }: Props) {
  const [state, formAction] = useActionState(action, null);
  const router = useRouter();

  if (state?.ok) {
    router.replace("/admin");
    return null;
  }

  return (
    <form action={formAction} className="mt-6 space-y-4">
      <input type="hidden" name="storeId" value={storeId} />
      <div>
        <label className="block text-xs font-medium text-zinc-600">
          新密碼
        </label>
        <input
          name="password"
          type="password"
          required
          minLength={6}
          placeholder="至少 6 碼"
          className="mt-1 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm outline-none focus:border-zinc-400"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-zinc-600">
          確認密碼
        </label>
        <input
          name="confirm"
          type="password"
          required
          minLength={6}
          placeholder="再輸入一次"
          className="mt-1 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm outline-none focus:border-zinc-400"
        />
      </div>
      {state?.error && (
        <p className="text-sm text-rose-600">{state.error}</p>
      )}
      <div className="flex gap-3">
        <button
          type="submit"
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
        >
          更新密碼
        </button>
        <a
          href="/admin"
          className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          取消
        </a>
      </div>
    </form>
  );
}
