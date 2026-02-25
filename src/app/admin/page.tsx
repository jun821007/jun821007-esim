import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { listStores } from "@/lib/db";
import { createStoreAccount } from "@/lib/auth";
import { getSession } from "@/lib/session";
import AdminCreateStoreForm from "./AdminCreateStoreForm";

export const dynamic = "force-dynamic";

async function createStoreAction(
  _prev: { ok: boolean; error?: string } | null,
  formData: FormData,
) {
  "use server";
  const name = (formData.get("name") as string)?.trim() || "";
  const slug = (formData.get("slug") as string)?.trim() || "";
  const password = (formData.get("password") as string) || "";
  if (!name || !slug || !password) {
    return { ok: false, error: "請填寫所有欄位" };
  }
  const result = await createStoreAccount(name, slug, password);
  if (result.ok) revalidatePath("/admin");
  return result;
}

export default async function AdminPage() {
  const session = await getSession();
  if (!session.admin) {
    redirect("/admin/login");
  }

  const stores = listStores();

  return (
    <div className="min-h-screen bg-zinc-50 px-4 py-8 font-sans text-zinc-900">
      <div className="mx-auto flex max-w-2xl flex-col gap-8">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              管理者後台
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              開新店家帳號
            </p>
          </div>
          <form action="/api/auth/logout?next=/admin/login" method="POST">
            <button
              type="submit"
              className="rounded-full border border-zinc-300 bg-white px-4 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
            >
              登出
            </button>
          </form>
        </header>

        <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-medium text-zinc-800">開新店家帳號</h2>
          <AdminCreateStoreForm action={createStoreAction} />
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-medium text-zinc-800">
            已開店家（共 {stores.length} 間）
          </h2>
          {stores.length === 0 ? (
            <p className="text-sm text-zinc-500">尚無店家帳號</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {stores.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between rounded-lg border border-zinc-100 px-3 py-2"
                >
                  <span className="font-medium text-zinc-800">{s.name}</span>
                  <code className="rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
                    {s.slug}
                  </code>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
