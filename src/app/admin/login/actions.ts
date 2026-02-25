"use server";

import { redirect } from "next/navigation";
import { verifyAdmin } from "@/lib/auth";
import { getSession } from "@/lib/session";

export async function adminLoginAction(
  _prev: unknown,
  formData: FormData,
): Promise<{ error?: string } | null> {
  const email = (formData.get("email") as string)?.trim() || "";
  const password = (formData.get("password") as string) || "";
  if (!email || !password) {
    return { error: "請輸入帳號與密碼" };
  }

  const ok = await verifyAdmin(email, password);
  if (!ok) {
    return { error: "帳號或密碼錯誤" };
  }

  const session = await getSession();
  session.admin = true;
  session.storeId = undefined;
  session.storeName = undefined;
  await session.save();

  redirect("/admin");
}
