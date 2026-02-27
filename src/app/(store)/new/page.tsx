import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createEsimRow, findEsimsByIds } from "@/lib/db";
import { getSession } from "@/lib/session";
import { CollapsibleSection, QrFileInputWithPreview, QrUploadSubmitButton, ShareLinkSubmitButton, UploadedModal, UploadErrorModal } from "./NewPageClient";

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

  const uploadBase = process.env.UPLOAD_PATH
    ? path.resolve(process.env.UPLOAD_PATH)
    : process.env.DATABASE_PATH && path.isAbsolute(process.env.DATABASE_PATH)
      ? path.dirname(process.env.DATABASE_PATH)
      : path.join(process.cwd(), "public");
  const uploadDir = path.join(uploadBase, "qr");
  const useApiRoute = Boolean(
    process.env.UPLOAD_PATH ||
      (process.env.DATABASE_PATH && path.isAbsolute(process.env.DATABASE_PATH))
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
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e && String((e as { digest?: unknown }).digest).startsWith("NEXT_REDIRECT")) throw e;
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

  try {
    const session = await getSession();
    const storeId = session.storeId ?? 1;

    const shareUrlRaw = (formData.get("shareUrl") as string) || "";
    const shareLines = shareUrlRaw
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    const ids: number[] = [];
    for (const line of shareLines) {
      ids.push(...parseIdsFromShareUrl(line));
    }

    if (ids.length === 0) {
      redirect("/new?uploaded=0");
    }

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
  } catch (e) {
    if (
      e &&
      typeof e === "object" &&
      "digest" in e &&
      String((e as { digest?: unknown }).digest).startsWith("NEXT_REDIRECT")
    )
      throw e;
    redirect("/new?error=upload");
  }
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
          <CollapsibleSection title="圖片入庫" defaultOpen>
            <p className="text-xs text-zinc-500">
              一次選多張 QR 圖片，系統會自動依方案資訊分別建立多筆 eSIM。
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
                <QrFileInputWithPreview />
                <p className="text-[10px] text-zinc-400">
                  一次選多張 QR 圖，系統會依照上面的方案資訊自動建立多筆 eSIM。
                </p>
              </div>

              <QrUploadSubmitButton />
            </form>
          </CollapsibleSection>

          <CollapsibleSection title="批量網址入庫" defaultOpen>
            <p className="text-xs text-zinc-500">
              貼上同行給的分享連結，系統會依連結內容批量入庫。
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
                  placeholder={`例如：http://xxx/share?ids=6,7,8
可多行貼上多個連結`}
                />
              </div>

              <ShareLinkSubmitButton />
            </form>
          </CollapsibleSection>
        </section>
      </div>
    </div>
  );
}

