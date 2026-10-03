import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { getSetting, setSetting } from "@/lib/db";
import { importParsedEsim, resolveImportStoreId } from "./importer";
import { htmlToText, parseEsimEmail } from "./parse";

const SINCE_KEY = "mailImport.since";
const SAFETY_SCAN_MS = 5 * 60 * 1000;
const RECONNECT_MS = 30 * 1000;
const LOG = "[mail-import]";

export type ScanResult = {
  checked: number;
  imported: number;
  duplicate: number;
  unparsed: number;
};

type Credentials = { user: string; pass: string };

type ScanState = {
  mailbox: string;
  processed: Set<number>;
  lastUid: number;
};

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

// 用「所有郵件」而不是收件匣，信被篩選器自動封存時也抓得到
async function resolveMailbox(client: ImapFlow): Promise<string> {
  const custom = process.env.AUTO_IMPORT_MAILBOX?.trim();
  if (custom) return custom;
  const list = await client.list();
  return list.find((m) => m.specialUse === "\\All")?.path ?? "INBOX";
}

async function processMessage(
  client: ImapFlow,
  uid: number,
  since: Date,
  storeId: number,
  result: ScanResult,
): Promise<void> {
  const msg = await client.fetchOne(
    String(uid),
    { source: true, internalDate: true, envelope: true },
    { uid: true },
  );
  if (!msg || !msg.source) {
    console.warn(LOG, `讀不到信件內容，略過：uid=${uid}`);
    return;
  }
  if (msg.internalDate && new Date(msg.internalDate) < since) {
    console.log(LOG, `早於起始時間，略過：uid=${uid} 收信時間=${new Date(msg.internalDate).toISOString()}`);
    return;
  }

  const from = process.env.AUTO_IMPORT_FROM?.trim().toLowerCase();
  if (
    from &&
    !msg.envelope?.from?.some((a) => a.address?.toLowerCase().includes(from))
  ) {
    console.log(
      LOG,
      `寄件者不符，略過：uid=${uid} 寄件者=${msg.envelope?.from?.map((a) => a.address).join(",") ?? ""}`,
    );
    return;
  }

  const mail = await simpleParser(msg.source);
  const content = mail.html ? htmlToText(mail.html) : mail.text || "";
  const esims = parseEsimEmail(content);

  if (esims.length === 0) {
    if (/ICCID|Activation/i.test(content)) {
      result.checked++;
      result.unparsed++;
      console.warn(LOG, `無法解析 eSIM 資料，略過：uid=${uid} 主旨=${mail.subject ?? ""}`);
    }
    return;
  }

  result.checked++;
  for (const esim of esims) {
    const status = await importParsedEsim(esim, storeId);
    if (status === "imported") {
      result.imported++;
      console.log(LOG, `已入庫 ICCID=${esim.iccid} ${esim.planName ?? ""}`);
    } else {
      result.duplicate++;
      console.log(LOG, `已存在，略過 ICCID=${esim.iccid}`);
    }
  }
}

async function scanMailbox(client: ImapFlow, state: ScanState): Promise<ScanResult> {
  const result: ScanResult = { checked: 0, imported: 0, duplicate: 0, unparsed: 0 };

  const storeId = resolveImportStoreId();
  if (!storeId) {
    console.error(
      LOG,
      `找不到入庫店家「${process.env.AUTO_IMPORT_STORE_SLUG || "001"}」，略過本次掃描`,
    );
    return result;
  }

  const lock = await client.getMailboxLock(state.mailbox);
  try {
    const uidNextAtStart = client.mailbox ? client.mailbox.uidNext : 0;
    const since = getSince();
    const candidates = new Set<number>();

    const byQuery = await client.search({ gmraw: buildQuery(since) }, { uid: true });
    for (const uid of byQuery || []) candidates.add(uid);

    // Gmail 搜尋索引有延遲，剛收到的信改用 UID 範圍直接抓
    if (state.lastUid > 0) {
      const fresh = await client.search({ uid: `${state.lastUid + 1}:*` }, { uid: true });
      for (const uid of fresh || []) {
        if (uid > state.lastUid) candidates.add(uid);
      }
    }

    for (const uid of [...candidates].sort((a, b) => a - b)) {
      if (state.processed.has(uid)) continue;
      try {
        await processMessage(client, uid, since, storeId, result);
        state.processed.add(uid);
      } catch (err) {
        console.error(LOG, `處理信件失敗 uid=${uid}，下次掃描會重試:`, err);
      }
    }

    state.lastUid = Math.max(state.lastUid, uidNextAtStart - 1);
  } finally {
    lock.release();
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
      const mailbox = await resolveMailbox(client);
      await client.mailboxOpen(mailbox);
      const state: ScanState = { mailbox, processed, lastUid: 0 };

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
              const r = await scanMailbox(client, state);
              if (r.checked) {
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
      console.log(LOG, `已連線 Gmail（${mailbox}），開始即時監聽新信`);
      trigger();
      await new Promise<void>((resolve) => client.once("close", () => resolve()));
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
  try {
    const mailbox = await resolveMailbox(client);
    return await scanMailbox(client, { mailbox, processed: new Set(), lastUid: 0 });
  } finally {
    await client.logout().catch(() => undefined);
  }
}
