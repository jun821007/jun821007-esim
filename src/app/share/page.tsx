import { notFound } from "next/navigation";
import { findEsimsByIds } from "@/lib/db";

type Props = {
  searchParams: Promise<{ ids?: string }>;
};

export const dynamic = "force-dynamic";

export default async function SharePage({ searchParams }: Props) {
  const params = await searchParams;
  const idsRaw = params.ids || "";
  const ids = idsRaw
    .split(",")
    .map((v) => Number(v.trim()))
    .filter((v) => !Number.isNaN(v) && v > 0);

  if (ids.length === 0) {
    notFound();
  }

  const esims = findEsimsByIds(ids);

  if (!esims.length) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-zinc-50 px-4 py-8 font-sans text-zinc-900">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <header className="text-center">
          <h1 className="text-xl font-semibold tracking-tight">
            eSIM QR 一覽
          </h1>
          <p className="mt-1 text-xs text-zinc-500">
            這個頁面會顯示多張 eSIM 的 QR 圖片，方便一次給同一位客人或同行。
          </p>
        </header>

        <div className="grid gap-4">
          {esims.map((esim) => (
            <div
              key={esim.id}
              className="rounded-2xl border border-zinc-200 bg-white p-4"
            >
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <div className="text-xs font-medium text-zinc-800">
                    {esim.country || "未命名方案"}
                  </div>
                  <div className="text-[11px] text-zinc-500">
                    {esim.planName || "—"}（ID #{esim.id}）
                  </div>
                </div>
              </div>
              {esim.qrPath ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={esim.qrPath}
                  alt={`eSIM QR #${esim.id}`}
                  className="mx-auto h-auto max-h-[360px] w-auto max-w-full rounded-lg border border-zinc-200 bg-white object-contain"
                />
              ) : (
                <p className="text-center text-xs text-zinc-400">
                  這筆 eSIM 沒有對應的 QR 圖片。
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

