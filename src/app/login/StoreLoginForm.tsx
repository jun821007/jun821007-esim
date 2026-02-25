"use client";

import { useActionState } from "react";
import { useEffect, useState } from "react";
import { storeLoginAction } from "./actions";

const STORAGE_KEY = "esim_store_login";

export default function StoreLoginForm() {
  const [state, formAction] = useActionState(storeLoginAction, null);
  const [slug, setSlug] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as { slug?: string; password?: string };
      if (saved.slug) {
        setSlug(saved.slug);
        setRemember(true);
      }
      if (saved.password) {
        setPassword(saved.password);
      }
    } catch {
      // ignore parse errors
    }
  }, []);

  function handleSubmit() {
    try {
      if (remember) {
        window.localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ slug, password }),
        );
      } else {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // ignore storage errors
    }
  }

  return (
    <form
      action={formAction}
      className="mt-6 space-y-4"
      onSubmit={handleSubmit}
    >
      <div>
        <label className="block text-xs font-medium text-zinc-700">
          帳號代碼
        </label>
        <input
          name="slug"
          type="text"
          required
          autoComplete="username"
          placeholder="例如：store-001"
          className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-400"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-zinc-700">
          密碼
        </label>
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          placeholder="密碼"
          className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-400"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <div className="flex items-center justify-between text-xs">
        <label className="inline-flex items-center gap-2 text-zinc-600">
          <input
            type="checkbox"
            className="h-3.5 w-3.5 rounded border-zinc-300 text-zinc-900 focus-visible:outline-none"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
          />
          <span>記住帳號密碼</span>
        </label>
      </div>
      {state?.error && (
        <p className="text-sm text-rose-600">{state.error}</p>
      )}
      <button
        type="submit"
        className="w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800"
      >
        登入
      </button>
    </form>
  );
}
