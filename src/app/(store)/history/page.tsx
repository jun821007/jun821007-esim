import { revalidatePath } from "next/cache";
import { listEsims, updateManyWithCustomer, type EsimRow } from "@/lib/db";
import { getSession } from "@/lib/session";
import HistoryGroups from "./HistoryGroups";

export const dynamic = "force-dynamic";

async function revertToStockAction(formData: FormData) {
  "use server";
  const session = await getSession();
  const storeId = session.storeId ?? 1;
  const idRaw = (formData.get("id") as string) || "";
  const id = Number(idRaw);
  if (!id || Number.isNaN(id)) return;
  updateManyWithCustomer([id], "UNUSED", null, storeId);
  revalidatePath("/history");
  revalidatePath("/");
}

export default async function HistoryPage() {
  const session = await getSession();
  const storeId = session.storeId ?? 1;
  const esims: EsimRow[] = listEsims(storeId);
  const history = esims.filter((e) => e.status !== "UNUSED");

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
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-full border border-zinc-300 bg-white px-4 py-2 text-xs font-medium text-zinc-700 hover:border-zinc-400"
          >
            回到庫存現貨
          </a>
        </header>

        <HistoryGroups history={history} revertAction={revertToStockAction} />
      </div>
    </div>
  );
}

