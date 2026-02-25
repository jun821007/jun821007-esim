import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import AdminLoginForm from "./AdminLoginForm";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const session = await getSession();
  if (session.admin) {
    const { from } = await searchParams;
    redirect(from || "/admin");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-zinc-800">管理者登入</h1>
        <p className="mt-1 text-sm text-zinc-500">
          僅管理者可登入
        </p>
        <AdminLoginForm />
        <a
          href="/login"
          className="mt-4 block text-center text-xs text-zinc-400 hover:text-zinc-600"
        >
          回到店家登入
        </a>
      </div>
    </div>
  );
}
