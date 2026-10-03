import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { getSetting, setSetting } from "@/lib/db";
import { importParsedEsim, resolveImportStoreId } from "./importer";
import { htmlToText, parseEsimEmail } from "./parse";

const SINCE_KEY = "mailImport.since";
const SAFETY_SCAN_MS = 10 * 60 * 1000;
const RECONNECT_MS = 30 * 1000;
const LOG = "[mail-import]";

export type ScanResult = {
  checked: number;
  imported: number;
  duplicate: number;
  unparsed: number;
};

type Credentials = { user: string; pass: string };

function getCredentials(): Credentials | null {
  const user = process.env.GMAIL_USER?.trim();
  const pass = process.env.GMAIL_APP_PASSWORD?.replace(/\s/g, "");
  return user && pass ? { user, pass } : null;
}

function createClient({ user, pass }: Credentials): ImapFlow {
  const client = new ImapFlow({
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    auth: { user, pass },
    logger: false,
    maxIdleTime: 10 * 60 * 1000,
  });
  client.on("error", (err) => console.error(LOG, "IMAP 錯誤:", err));
  return client;
}

// 第一次啟用時記下當下時間，之後只匯入這個時間之後收到的信，避免把以前手動入過庫的舊信重複匯入
function getSince(): Date {
  const override = process.env.AUTO_IMPORT_SINCE?.trim();
  if (override) {
    const iso = /^\d{4}-\d{2}-\d{2}$/.test(override)
      ? `${override}T00:00:00+08:00`
      : override;
    const date = new Date(iso);
    if (!Number.isNaN(date.getTime())) return date;
    console.error(LOG, `AUTO_IMPORT_SINCE 格式錯誤：${override}，改用預設起始時間`);
  }
  const stored = getSetting(SINCE_KEY);
  if (stored) return new Date(stored);
  const now = new Date();
  setSetting(SINCE_KEY, now.toISOString());
  return now;
}

function buildQuery(since: Date): string {
  const custom = process.env.AUTO_IMPORT_GMAIL_QUERY?.trim();
  if (custom) return custom;
  const after = Math.floor(since.getTime() / 1000) - 3600;
  const from = process.env.AUTO_IMPORT_FROM?.trim();
  return from ? `from:${from} after:${after}` : `ICCID after:${after}`;
}

async function scanMailbox(
  client: ImapFlow,
  processed: Set<number>,
): Promise<ScanResult> {
  const result: ScanResult = { checked: 0, imported: 0, duplicate: 0, unparsed: 0 };

  const storeId = resolveImportStoreId();
  if (!storeId) {
    console.error(
      LOG,
      `找不到入庫店家「${process.env.AUTO_IMPORT_STORE_SLUG || "001"}」，略過本次掃描`,
    );
    return result;
  }

  const since = getSince();
  const uids = await client.search({ gmraw: buildQuery(since) }, { uid: true });
  if (!uids) return result;

  for (const uid of uids) {
    if (processed.has(uid)) continue;
    try {
      const msg = await client.fetchOne(
        String(uid),
        { source: true, internalDate: true },
        { uid: true },
      );
      if (!msg || !msg.source) {
        processed.add(uid);
        continue;
      }
      if (msg.internalDate && new Date(msg.internalDate) < since) {
        processed.add(uid);
        continue;
      }

      result.checked++;
      const mail = await simpleParser(msg.source);
      const content = mail.html ? htmlToText(mail.html) : mail.text || "";
      const esims = parseEsimEmail(content);

      if (esims.length === 0) {
        result.unparsed++;
        console.warn(LOG, `無法解析 eSIM 資料，略過：uid=${uid} 主旨=${mail.subject ?? ""}`);
      }
      for (const esim of esims) {
        const status = await importParsedEsim(esim, storeId);
        if (status === "imported") {
          result.imported++;
          console.log(LOG, `已入庫 ICCID=${esim.iccid} ${esim.planName ?? ""}`);
        } else {
          result.duplicate++;
        }
      }
      processed.add(uid);
    } catch (err) {
      console.error(LOG, `處理信件失敗 uid=${uid}，下次掃描會重試:`, err);
    }
  }
  return result;
}

const globalForWatcher = globalThis as unknown as { esimMailWatcherStarted?: boolean };

export function startMailWatcher(): void {
  if (globalForWatcher.esimMailWatcherStarted) return;
  const creds = getCredentials();
  if (!creds) {
    console.log(LOG, "未設定 GMAIL_USER / GMAIL_APP_PASSWORD，不啟用 Email 自動入庫");
    return;
  }
  globalForWatcher.esimMailWatcherStarted = true;
  void watchLoop(creds);
}

async function watchLoop(creds: Credentials): Promise<never> {
  const processed = new Set<number>();
  for (;;) {
    const client = createClient(creds);
    let timer: NodeJS.Timeout | undefined;
    try {
      await client.connect();
      const lock = await client.getMailboxLock("INBOX");
      try {
        let running = false;
        let again = false;
        const trigger = () => {
          if (running) {
            again = true;
            return;
          }
          running = true;
          void (async () => {
            try {
              do {
                again = false;
                const r = await scanMailbox(client, processed);
                if (r.imported || r.unparsed) {
                  console.log(LOG, `掃描完成：入庫 ${r.imported}、重複 ${r.duplicate}、無法解析 ${r.unparsed}`);
                }
              } while (again);
            } catch (err) {
              console.error(LOG, "掃描失敗:", err);
            } finally {
              running = false;
            }
          })();
        };

        client.on("exists", trigger);
        timer = setInterval(trigger, SAFETY_SCAN_MS);
        console.log(LOG, "已連線 Gmail，開始即時監聽新信");
        trigger();
        await new Promise<void>((resolve) => client.once("close", () => resolve()));
      } finally {
        lock.release();
      }
    } catch (err) {
      console.error(LOG, "Gmail 連線失敗:", err);
    } finally {
      if (timer) clearInterval(timer);
      client.removeAllListeners("exists");
      await client.logout().catch(() => undefined);
    }
    console.log(LOG, `連線中斷，${RECONNECT_MS / 1000} 秒後重新連線`);
    await new Promise((r) => setTimeout(r, RECONNECT_MS));
  }
}

export async function runMailImportOnce(): Promise<ScanResult> {
  const creds = getCredentials();
  if (!creds) throw new Error("GMAIL_USER / GMAIL_APP_PASSWORD 未設定");
  const client = createClient(creds);
  await client.connect();
  const lock = await client.getMailboxLock("INBOX");
  try {
    return await scanMailbox(client, new Set());
  } finally {
    lock.release();
    await client.logout().catch(() => undefined);
  }
}
