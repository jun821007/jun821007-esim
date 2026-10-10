import { revalidatePath } from "next/cache";
import Link from "next/link";
import {
  findEsimsByIds,
  getLatestAgreedConsentByEsimIds,
  listEsims,
  setEsimPosOrderId,
  updateManyWithCustomer,
  type EsimRow,
} from "@/lib/db";
import { isPosStore, revertEsimInPos } from "@/lib/pos";
import { getSession } from "@/lib/session";
import HistoryGroups from "./HistoryGroups";
import type { RevertResult } from "./RevertButton";

export const dynamic = "force-dynamic";

async function revertToStockAction(id: number): Promise<RevertResult> {
  "use server";
  const session = await getSession();
  const storeId = session.storeId ?? 1;
  if (!id || Number.isNaN(id)) return { ok: false, error: "卡片編號錯誤" };
  const [esim] = findEsimsByIds([id], storeId);
  if (!esim) return { ok: false, error: "找不到這張卡" };

  // 先刪 POS 那筆，成功才衝正 eSIM，避免兩邊不一致
  if (esim.posOrderId) {
    try {
      await revertEsimInPos(id, esim.posOrderId);
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
    setEsimPosOrderId([id], null);
  }
  updateManyWithCustomer([id], "UNUSED", null, storeId);
  revalidatePath("/history");
  revalidatePath("/");
  return { ok: true };
}

export default async function HistoryPage() {
  const session = await getSession();
  const storeId = session.storeId ?? 1;
  const esims: EsimRow[] = listEsims(storeId);
  const history = esims.filter((e) => e.status !== "UNUSED");
  const consentByEsimId = getLatestAgreedConsentByEsimIds(
    history.map((e) => e.id),
  );

  return (
    <div className="min-h-screen bg-zinc-50 px-4 py-8 font-sans text-zinc-900">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              eSIM 歷史流水
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              同一個人分組、可收折，可再次開啟或複製分享連結。
            </p>
          </div>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-full border border-zinc-300 bg-white px-4 py-2 text-xs font-medium text-zinc-700 hover:border-zinc-400"
          >
            回到庫存現貨
          </Link>
        </header>

        <HistoryGroups
          history={history}
          consentByEsimId={consentByEsimId}
          revertAction={revertToStockAction}
          posEnabled={isPosStore(storeId)}
        />
      </div>
    </div>
  );
}

