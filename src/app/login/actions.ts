"use server";

import { redirect } from "next/navigation";
import { verifyStore } from "@/lib/auth";
import { getSession } from "@/lib/session";

export async function storeLoginAction(
  _prev: unknown,
  formData: FormData,
): Promise<{ error?: string } | null> {
  try {
    const slug = (formData.get("slug") as string)?.trim() || "";
    const password = (formData.get("password") as string) || "";
    if (!slug || !password) {
      return { error: "請輸入帳號與密碼" };
    }

    const store = await verifyStore(slug, password);
    if (!store) {
      return { error: "帳號或密碼錯誤" };
    }

    const session = await getSession();
    session.storeId = store.id;
    session.storeName = store.name;
    session.admin = false;
    await session.save();

    redirect("/");
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e && String((e as { digest?: unknown }).digest).startsWith("NEXT_REDIRECT")) {
      throw e;
    }
    console.error("storeLoginAction error:", e);
    return { error: "登入失敗，請稍後再試" };
  }
}
