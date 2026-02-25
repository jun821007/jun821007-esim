"use client";

import { useActionState } from "react";

type Props = {
  action: (
    prev: { ok: boolean; error?: string } | null,
    formData: FormData,
  ) => Promise<{ ok: boolean; error?: string }>;
};

export default function AdminCreateStoreForm({ action }: Props) {
  const [state, formAction] = useActionState(action, null);

  return (
    <form action={formAction} className="mt-4 space-y-4">
      <div>
        <label className="block text-xs font-medium text-zinc-600">
          店家名稱
        </label>
        <input
          name="name"
          type="text"
          required
          placeholder="例如：XX 電信"
          className="mt-1 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm outline-none focus:border-zinc-400"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-zinc-600">
          帳號代碼（英數字與連字號）
        </label>
        <input
          name="slug"
          type="text"
          required
          placeholder="例如：store-001"
          className="mt-1 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm outline-none focus:border-zinc-400"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-zinc-600">
          密碼
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
      {state?.error && (
        <p className="text-sm text-rose-600">{state.error}</p>
      )}
      {state?.ok && (
        <p className="text-sm text-emerald-600">已建立店家帳號</p>
      )}
      <button
        type="submit"
        className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
      >
        建立店家
      </button>
    </form>
  );
}
