import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import fs from "node:fs/promises";
import path from "node:path";
import { createEsimRow, findEsimsByIds } from "@/lib/db";
import { getSession } from "@/lib/session";
import { CollapsibleSection, QrUploadSubmitButton, UploadedModal, UploadErrorModal } from "./NewPageClient";

export const dynamic = "force-dynamic";

function parseIdsFromShareUrl(input: string): number[] {
  const trimmed = input.trim();
  if (!trimmed) return [];
  try {
    const url = trimmed.startsWith("http")
      ? new URL(trimmed)
      : new URL(trimmed, "http://localhost");
    const idsRaw = url.searchParams.get("ids") || "";
    return idsRaw
      .split(",")
      .map((v) => Number(v.trim()))
      .filter((v) => !Number.isNaN(v) && v > 0);
  } catch {
    const match = trimmed.match(/ids=([^&\s#]+)/);
    if (match) {
      return match[1]
        .split(",")
        .map((v) => Number(v.trim()))
        .filter((v) => !Number.isNaN(v) && v > 0);
    }
    return [];
  }
}

async function createFromFiles(formData: FormData) {
  "use server";

  try {
  const session = await getSession();
  const storeId = session.storeId ?? 1;

  const country = (formData.get("country") as string)?.trim() || null;
  const planName = (formData.get("planName") as string)?.trim() || null;
  const notes = (formData.get("notes") as string)?.trim() || null;

  const files = formData.getAll("qrFiles") as File[];

  const uploadBase =
    process.env.DATABASE_PATH && path.isAbsolute(process.env.DATABASE_PATH)
      ? path.dirname(process.env.DATABASE_PATH)
      : path.join(process.cwd(), "public");
  const uploadDir = path.join(uploadBase, "qr");
  const useApiRoute = Boolean(
    process.env.DATABASE_PATH && path.isAbsolute(process.env.DATABASE_PATH)
  );
  await fs.mkdir(uploadDir, { recursive: true });

  let count = 0;

  if (files.length === 0) {
    createEsimRow({
      storeId,
      country,
      planName,
      days: null,
      batchName: null,
      costPrice: null,
      sellPrice: null,
      notes,
      qrPath: null,
    });
    count = 1;
  } else {
    for (const file of files) {
      if (!(file instanceof File)) continue;
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const ext = file.name.split(".").pop() || "png";
      const fileName = `${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}.${ext}`;
      const filePath = path.join(uploadDir, fileName);
      await fs.writeFile(filePath, buffer);

      createEsimRow({
        storeId,
        country,
        planName,
        days: null,
        batchName: null,
        costPrice: null,
        sellPrice: null,
        notes,
        qrPath: useApiRoute ? `/api/qr/${fileName}` : `/qr/${fileName}`,
      });
      count++;
    }
  }

  revalidatePath("/");
  redirect(`/new?uploaded=${count}`);
  } catch {
    redirect("/new?error=upload");
  }
}

async function createFromUrls(formData: FormData) {
  "use server";

  const session = await getSession();
  const storeId = session.storeId ?? 1;

  const country = (formData.get("country") as string)?.trim() || null;
  const planName = (formData.get("planName") as string)?.trim() || null;
  const notes = (formData.get("notes") as string)?.trim() || null;
  const urlsRaw = (formData.get("qrUrls") as string) || "";

  const urls = urlsRaw
    .split(/\r?\n/)
    .map((u) => u.trim())
    .filter(Boolean);

  if (urls.length === 0) return;

  for (const url of urls) {
    createEsimRow({
      storeId,
      country,
      planName,
      days: null,
      batchName: null,
      costPrice: null,
      sellPrice: null,
      notes,
      qrPath: url,
    });
  }

  revalidatePath("/");
  redirect(`/new?uploaded=${urls.length}`);
}

async function createFromShareLink(formData: FormData) {
  "use server";

  const session = await getSession();
  const storeId = session.storeId ?? 1;

  const shareUrlRaw = (formData.get("shareUrl") as string) || "";
  const lines = shareUrlRaw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const ids: number[] = [];
  for (const line of lines) {
    ids.push(...parseIdsFromShareUrl(line));
  }

  if (ids.length === 0) return;

  const esims = findEsimsByIds(ids);
  let count = 0;

  for (const esim of esims) {
    createEsimRow({
      storeId,
      country: esim.country,
      planName: esim.planName,
      days: esim.days,
      batchName: esim.batchName,
      costPrice: esim.costPrice,
      sellPrice: esim.sellPrice,
      notes: esim.notes,
      qrPath: esim.qrPath,
    });
    count++;
  }

  revalidatePath("/");
  redirect(`/new?uploaded=${count}`);
}

export default async function NewPage() {
  return (
    <div className="min-h-screen bg-zinc-50 px-4 py-8 font-sans text-zinc-900">
      <div className="mx-auto flex max-w-4xl flex-col gap-8">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              新增 / 入庫 eSIM
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              這個頁面專門用來「入庫」，可以透過上傳 QR 圖片或貼上批量 QR 網址，一次建立多筆
              eSIM。
            </p>
          </div>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-full border border-zinc-300 bg-white px-4 py-2 text-xs font-medium text-zinc-700 hover:border-zinc-400"
          >
            回到庫存現貨
          </a>
        </header>

        <Suspense fallback={null}>
          <UploadErrorModal />
          <UploadedModal />
        </Suspense>

        <section className="flex flex-col gap-4">
          <CollapsibleSection title="方式一：上傳 QR 圖片批量入庫" defaultOpen>
            <p className="text-xs text-zinc-500">
              廠商寄來一批 QR 圖片時，一次選多張圖片，系統會依照方案資訊自動入庫。
            </p>

            <form action={createFromFiles} className="mt-4 space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-zinc-600">
                    國家 / 區域
                  </label>
                  <input
                    name="country"
                    type="text"
                    className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm outline-none ring-0 transition focus:border-zinc-400 focus:bg-white"
                    placeholder="例如：日本、歐洲多國"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-zinc-600">
                    方案名稱
                  </label>
                  <input
                    name="planName"
                    type="text"
                    className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm outline-none ring-0 transition focus:border-zinc-400 focus:bg-white"
                    placeholder="例如：10 天 20GB"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-zinc-600">
                  備註
                </label>
                <textarea
                  name="notes"
                  rows={2}
                  className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm outline-none ring-0 transition focus:border-zinc-400 focus:bg-white"
                  placeholder="例如：這批是 A 廠商，含語音 / 特殊限制等"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-zinc-600">
                  QR 圖片（可多選）
                </label>
                <input
                  name="qrFiles"
                  type="file"
                  accept="image/*"
                  multiple
                  className="block w-full cursor-pointer rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-3 py-6 text-xs text-zinc-500 file:hidden hover:border-zinc-400"
                />
                <p className="text-[10px] text-zinc-400">
                  一次選多張 QR 圖，系統會依照上面的方案資訊自動建立多筆 eSIM。
                </p>
              </div>

              <QrUploadSubmitButton />
            </form>
          </CollapsibleSection>

          <CollapsibleSection
            title="方式二：從分享連結批量入庫"
            defaultOpen
          >
            <p className="text-xs text-zinc-500">
              貼上別人按「批量出貨」後給你的分享連結，一網址即可批量入庫。
            </p>

            <form action={createFromShareLink} className="mt-4 space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-zinc-600">
                  分享連結
                </label>
                <textarea
                  name="shareUrl"
                  rows={3}
                  required
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none ring-0 transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                  placeholder={`例如：http://xxx/share?ids=6,7,8 或 /share?ids=6,7,8
可多行貼上多個連結`}
                />
              </div>

              <input
                type="submit"
                value="一網址批量入庫"
                className="sticky bottom-4 z-10 min-h-[48px] w-full touch-manipulation cursor-pointer rounded-lg border-0 bg-sky-700 px-4 py-3 text-base font-medium text-white shadow-lg active:bg-sky-800"
              />
            </form>
          </CollapsibleSection>

          <CollapsibleSection title="方式三：貼上 QR 圖片網址批量入庫">
            <p className="text-xs text-zinc-500">
              同行如果給你一串「QR 圖片網址」（每行一個），直接貼在下面，系統會一次入庫。
            </p>

            <form action={createFromUrls} className="mt-4 space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-zinc-600">
                    國家 / 區域
                  </label>
                  <input
                    name="country"
                    type="text"
                    className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm outline-none ring-0 transition focus:border-zinc-400 focus:bg-white"
                    placeholder="例如：日本、歐洲多國"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-zinc-600">
                    方案名稱
                  </label>
                  <input
                    name="planName"
                    type="text"
                    className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm outline-none ring-0 transition focus:border-zinc-400 focus:bg-white"
                    placeholder="例如：10 天 20GB"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-zinc-600">
                  備註
                </label>
                <textarea
                  name="notes"
                  rows={2}
                  className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm outline-none ring-0 transition focus:border-zinc-400 focus:bg-white"
                  placeholder="例如：這批是 B 同行給的、含特定限制等"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-zinc-600">
                  QR 網址（每行一個）
                </label>
                <textarea
                  name="qrUrls"
                  rows={8}
                  className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs outline-none ring-0 transition focus:border-zinc-400 focus:bg-white"
                  placeholder={`例如：\nhttps://example.com/qr1.png\nhttps://example.com/qr2.png\n...`}
                />
                <p className="text-[10px] text-zinc-400">
                  直接從同行那邊複製「一整串」貼過來就好，系統會自動一行一張建立多筆 eSIM。
                </p>
              </div>

              <button
                type="submit"
                className="inline-flex w-full items-center justify-center rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 active:bg-zinc-950"
              >
                依網址批量入庫
              </button>
            </form>
          </CollapsibleSection>
        </section>
      </div>
    </div>
  );
}

