import { revalidatePath } from "next/cache";
import {
  deleteEsimRow,
  listEsims,
  updateEsimRow,
  updateManyStatus,
  updateManyWithCustomer,
  type EsimRow,
  type EsimStatus,
} from "@/lib/db";
import { getSession } from "@/lib/session";
import InventoryTable from "./InventoryTable";

export const dynamic = "force-dynamic";

async function updateEsim(formData: FormData) {
  "use server";

  const session = await getSession();
  const storeId = session.storeId ?? 1;

  const idRaw = formData.get("id") as string;
  const id = Number(idRaw);
  if (!id || Number.isNaN(id)) return;

  const status = (formData.get("status") as EsimStatus) || "UNUSED";
  const customerName =
    ((formData.get("customerName") as string) || "").trim() || null;
  const customerContact =
    ((formData.get("customerContact") as string) || "").trim() || null;
  const notes = ((formData.get("notes") as string) || "").trim() || null;

  updateEsimRow({
    id,
    storeId,
    status,
    customerName,
    customerContact,
    notes,
  });

  revalidatePath("/");
}

async function bulkUpdateStatusAction(formData: FormData) {
  "use server";

  const session = await getSession();
  const storeId = session.storeId ?? 1;

  const idsRaw = (formData.get("ids") as string) || "";
  const status = (formData.get("status") as EsimStatus) || "UNUSED";
  const customerName = ((formData.get("customerName") as string) || "").trim() || null;
  const ids = idsRaw
    .split(",")
    .map((v) => Number(v.trim()))
    .filter((v) => !Number.isNaN(v) && v > 0);

  if (ids.length === 0) return;

  updateManyWithCustomer(ids, status, customerName, storeId);
  revalidatePath("/");
}

async function deleteEsimAction(formData: FormData) {
  "use server";

  const session = await getSession();
  const storeId = session.storeId ?? 1;

  const idsRaw = (formData.get("ids") as string) || "";
  const ids = idsRaw
    .split(",")
    .map((v) => Number(v.trim()))
    .filter((v) => !Number.isNaN(v) && v > 0);

  if (ids.length === 0) return;

  for (const id of ids) {
    deleteEsimRow(id, storeId);
  }

  revalidatePath("/");
}

export default async function Home() {
  const session = await getSession();
  const storeId = session.storeId ?? 1;
  const esims: EsimRow[] = listEsims(storeId);
  const inStock = esims.filter((e) => e.status === "UNUSED");
  const history = esims.filter((e) => e.status !== "UNUSED");

  return (
    <div className="min-h-screen bg-zinc-50 px-4 py-8 font-sans text-zinc-900">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              eSIM 庫存現貨
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              這裡只顯示「未使用」的 eSIM，方便你快速出貨與批量操作；其他狀態會進到歷史流水。
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <a
              href="/history"
              className="inline-flex items-center justify-center rounded-full border border-zinc-300 bg-white px-4 py-2 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50 active:bg-zinc-100"
            >
              歷史流水
            </a>
            <a
              href="/new"
              className="inline-flex items-center justify-center rounded-full bg-zinc-900 px-4 py-2 text-xs font-medium text-white transition hover:bg-zinc-800 active:bg-zinc-950"
            >
              新增 / 入庫 eSIM
            </a>
            <form action="/api/auth/logout?next=/login" method="POST" className="inline">
              <button
                type="submit"
                className="rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-[11px] font-medium text-zinc-500 hover:bg-zinc-50"
              >
                登出
              </button>
            </form>
          </div>
        </header>

        <InventoryTable
          inStock={inStock}
          history={history}
          updateEsim={updateEsim}
          bulkUpdateStatus={bulkUpdateStatusAction}
          bulkDelete={deleteEsimAction}
        />
      </div>
    </div>
  );
}
