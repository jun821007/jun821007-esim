import Link from "next/link";
import { redirect } from "next/navigation";
import { getPosMap, isPosStore } from "@/lib/pos";
import { getSession } from "@/lib/session";
import PosMapEditor from "./PosMapEditor";

export const dynamic = "force-dynamic";

export default async function PosSettingsPage() {
  const session = await getSession();
  if (!isPosStore(session.storeId ?? 1)) redirect("/");

  return (
    <div className="min-h-screen bg-zinc-50 px-4 py-8 font-sans text-zinc-900">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">POS 對照表</h1>
            <p className="mt-1 text-sm text-zinc-500">
              出貨時用「國家＋方案」比對關鍵字，對到的 POS 預設卡就用它的售價／成本掛帳；對不到的會以「待填價」掛進 POS，之後在 POS 未結單補金額。
            </p>
          </div>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-full border border-zinc-300 bg-white px-4 py-2 text-xs font-medium text-zinc-700 hover:border-zinc-400"
          >
            回到庫存現貨
          </Link>
        </header>
        <PosMapEditor initialRules={getPosMap()} />
      </div>
    </div>
  );
}
