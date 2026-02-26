import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Link from "next/link";
import { findStoreById } from "@/lib/db";
import { changeStorePassword, requireAdmin } from "@/lib/auth";
import { getSession } from "@/lib/session";
import AdminChangePasswordForm from "./AdminChangePasswordForm";

export const dynamic = "force-dynamic";

async function changePasswordAction(
  _prev: { ok: boolean; error?: string } | null,
  formData: FormData,
) {
  "use server";
  const session = await getSession();
  if (!session.admin) return { ok: false, error: "僅管理者可更改店家密碼" };
  const storeId = parseInt(formData.get("storeId") as string, 10);
  const password = (formData.get("password") as string) || "";
  const confirm = (formData.get("confirm") as string) || "";
  if (!password || !confirm) {
    return { ok: false, error: "請填寫新密碼與確認密碼" };
  }
  if (password !== confirm) {
    return { ok: false, error: "兩次輸入的密碼不一致" };
  }
  const result = await changeStorePassword(storeId, password);
  if (result.ok) revalidatePath("/admin");
  return result;
}

export default async function AdminChangePasswordPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ok = await requireAdmin();
  if (!ok) redirect("/admin/login");

  const { id } = await params;
  const storeId = parseInt(id, 10);
  if (isNaN(storeId)) redirect("/admin");

  const store = findStoreById(storeId);
  if (!store) redirect("/admin");

  return (
    <div className="min-h-screen bg-zinc-50 px-4 py-8 font-sans text-zinc-900">
      <div className="mx-auto max-w-md">
        <Link
          href="/admin"
          className="mb-6 inline-block text-sm text-zinc-500 hover:text-zinc-700"
        >
          ← 返回後台
        </Link>
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-zinc-800">
            更改店家密碼
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            {store.name}（{store.slug}）
          </p>
          <AdminChangePasswordForm
            storeId={store.id}
            storeName={store.name}
            action={changePasswordAction}
          />
        </div>
      </div>
    </div>
  );
}
