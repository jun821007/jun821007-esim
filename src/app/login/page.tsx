import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import StoreLoginForm from "./StoreLoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const session = await getSession();
  if (session.storeId && session.storeName) {
    const { from } = await searchParams;
    redirect(from || "/");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-zinc-800">店家登入</h1>
        <p className="mt-1 text-sm text-zinc-500">
          輸入帳號與密碼登入
        </p>
        <StoreLoginForm />
      </div>
    </div>
  );
}
