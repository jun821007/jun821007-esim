import Link from "next/link";
import { redirect } from "next/navigation";
import { listEsims } from "@/lib/db";
import { collectShipmentNames, getPosBindings, isPosStore } from "@/lib/pos";
import { getSession } from "@/lib/session";
import PosMapEditor from "./PosMapEditor";

export const dynamic = "force-dynamic";

export default async function PosSettingsPage() {
  const session = await getSession();
  const storeId = session.storeId ?? 1;
  if (!isPosStore(storeId)) redirect("/");

  return (
    <div className="min-h-screen bg-zinc-50 px-4 py-8 font-sans text-zinc-900">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">POS 對照表</h1>
            <p className="mt-1 text-sm text-zinc-500">
              從已出貨紀錄點國家和方案名稱（天數在方案名稱裡），再指定 POS 常用卡。出貨用那張卡的售價和成本。還沒綁的一樣可以出貨，到 POS 未結再填價。
            </p>
          </div>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-full border border-zinc-300 bg-white px-4 py-2 text-xs font-medium text-zinc-700 hover:border-zinc-400"
          >
            回到庫存現貨
          </Link>
        </header>
        <PosMapEditor
          names={collectShipmentNames(
            listEsims(storeId).filter((e) => e.status === "CUSTOMER" || e.status === "PEER"),
          )}
          initialBindings={getPosBindings()}
        />
      </div>
    </div>
  );
}
