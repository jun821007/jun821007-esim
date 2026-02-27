import Database from "better-sqlite3";
import nodeFs from "node:fs";
import nodePath from "node:path";

export type EsimStatus = "UNUSED" | "CUSTOMER" | "PEER" | "VOID";

export type StoreRow = {
  id: number;
  name: string;
  slug: string;
  passwordHash: string;
  createdAt: string;
};

export type EsimRow = {
  id: number;
  storeId: number | null;
  country: string | null;
  planName: string | null;
  days: number | null;
  batchName: string | null;
  status: string; // keep as string for forward compatibility
  costPrice: number | null;
  sellPrice: number | null;
  customerName: string | null;
  customerContact: string | null;
  notes: string | null;
  qrPath: string | null;
  createdAt: string;
  updatedAt: string;
};

const globalForDb = globalThis as unknown as {
  esimDb?: Database.Database;
};

const dbPath =
  process.env.DATABASE_PATH ||
  (process.env.DATABASE_URL?.startsWith("file:")
    ? process.env.DATABASE_URL.replace(/^file:/, "")
    : undefined) ||
  "dev.db";

const _resolvedDbPath = nodePath.resolve(dbPath);
const _dbDir = nodePath.dirname(_resolvedDbPath);
if (!nodeFs.existsSync(_dbDir)) {
  nodeFs.mkdirSync(_dbDir, { recursive: true });
}

const db =
  globalForDb.esimDb ??
  new Database(_resolvedDbPath, {
    fileMustExist: false,
  });

if (!globalForDb.esimDb) {
  globalForDb.esimDb = db;
}

db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS "Store" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL UNIQUE,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS "Esim" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "country" TEXT,
    "planName" TEXT,
    "days" INTEGER,
    "batchName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'UNUSED',
    "costPrice" REAL,
    "sellPrice" REAL,
    "customerName" TEXT,
    "customerContact" TEXT,
    "notes" TEXT,
    "qrPath" TEXT,
    "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
    "updatedAt" TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Migration: add qrPath column if it does not exist yet
try {
  const info = db
    .prepare<unknown[], { name: string }>(
      `PRAGMA table_info("Esim")`,
    )
    .all();
  const hasQrPath = info.some((c) => c.name === "qrPath");
  if (!hasQrPath) {
    db.exec(`ALTER TABLE "Esim" ADD COLUMN "qrPath" TEXT;`);
  }
  const hasStoreId = info.some((c) => c.name === "storeId");
  if (!hasStoreId) {
    db.exec(`ALTER TABLE "Esim" ADD COLUMN "storeId" INTEGER REFERENCES "Store"("id");`);
  }
} catch {
  // ignore migration errors
}

export function listStores(): StoreRow[] {
  const stmt = db.prepare<unknown[], StoreRow>(
    `SELECT * FROM "Store" ORDER BY "id" ASC`,
  );
  return stmt.all();
}

export function createStore(data: {
  name: string;
  slug: string;
  passwordHash: string;
}): void {
  const stmt = db.prepare(
    `INSERT INTO "Store" ("name","slug","passwordHash","createdAt")
     VALUES (@name, @slug, @passwordHash, datetime('now'))`,
  );
  stmt.run(data);
}

export function findStoreBySlug(slug: string): StoreRow | undefined {
  const stmt = db.prepare<[string], StoreRow>(
    `SELECT * FROM "Store" WHERE "slug" = ?`,
  );
  return stmt.get(slug);
}

export function findStoreById(id: number): StoreRow | undefined {
  const stmt = db.prepare<[number], StoreRow>(
    `SELECT * FROM "Store" WHERE "id" = ?`,
  );
  return stmt.get(id);
}

export function updateStorePassword(storeId: number, passwordHash: string): void {
  const stmt = db.prepare(
    `UPDATE "Store" SET "passwordHash" = ? WHERE "id" = ?`,
  );
  stmt.run(passwordHash, storeId);
}

export function listEsims(storeId: number): EsimRow[] {
  const stmt = db.prepare<unknown[], EsimRow>(
    `SELECT * FROM "Esim" WHERE ("storeId" = ? OR ("storeId" IS NULL AND ? = 1))
     ORDER BY status ASC, createdAt DESC`,
  );
  return stmt.all(storeId, storeId);
}

export function createEsimRow(data: {
  storeId: number | null;
  country: string | null;
  planName: string | null;
  days: number | null;
  batchName: string | null;
  costPrice: number | null;
  sellPrice: number | null;
  notes: string | null;
  qrPath: string | null;
}): void {
  const stmt = db.prepare(
    `INSERT INTO "Esim"
      ("storeId","country","planName","days","batchName","costPrice","sellPrice","notes","qrPath","status","createdAt","updatedAt")
     VALUES (@storeId, @country, @planName, @days, @batchName, @costPrice, @sellPrice, @notes, @qrPath, 'UNUSED', datetime('now'), datetime('now'))`,
  );
  stmt.run(data);
}

export function updateEsimRow(data: {
  id: number;
  storeId?: number;
  status: EsimStatus;
  customerName: string | null;
  customerContact: string | null;
  notes: string | null;
}): void {
  const where =
    data.storeId != null
      ? `WHERE "id" = @id AND "storeId" = @storeId`
      : `WHERE "id" = @id`;
  const stmt = db.prepare(
    `UPDATE "Esim"
      SET "status" = @status,
          "customerName" = @customerName,
          "customerContact" = @customerContact,
          "notes" = @notes,
          "updatedAt" = datetime('now')
      ${where}`,
  );
  stmt.run(data);
}

export function deleteEsimRow(id: number, storeId?: number): void {
  if (storeId != null) {
    const stmt = db.prepare(
      `DELETE FROM "Esim" WHERE "id" = ? AND "storeId" = ?`,
    );
    stmt.run(id, storeId);
  } else {
    const stmt = db.prepare(`DELETE FROM "Esim" WHERE "id" = ?`);
    stmt.run(id);
  }
}

/** 刪除已出貨且超過 30 天的紀錄（已給客人／已給同行／作廢），不刪庫存 */
export function deleteShippedEsims(): number {
  const stmt = db.prepare(
    `DELETE FROM "Esim"
     WHERE "status" IN ('CUSTOMER','PEER','VOID')
     AND (julianday('now') - julianday("updatedAt")) >= 30`,
  );
  const result = stmt.run();
  return result.changes;
}

export function updateManyStatus(
  ids: number[],
  status: EsimStatus,
  storeId?: number,
): void {
  if (!ids.length) return;
  const placeholders = ids.map(() => "?").join(",");
  const where =
    storeId != null
      ? `WHERE "id" IN (${placeholders}) AND "storeId" = ?`
      : `WHERE "id" IN (${placeholders})`;
  const stmt = db.prepare(
    `UPDATE "Esim" SET "status" = ?, "updatedAt" = datetime('now') ${where}`,
  );
  stmt.run(status, ...ids, ...(storeId != null ? [storeId] : []));
}

export function updateManyWithCustomer(
  ids: number[],
  status: EsimStatus,
  customerName: string | null,
  storeId?: number,
): void {
  if (!ids.length) return;
  const placeholders = ids.map(() => "?").join(",");
  const where =
    storeId != null
      ? `WHERE "id" IN (${placeholders}) AND "storeId" = ?`
      : `WHERE "id" IN (${placeholders})`;
  const stmt = db.prepare(
    `UPDATE "Esim"
     SET "status" = ?, "customerName" = ?, "updatedAt" = datetime('now')
     ${where}`,
  );
  stmt.run(status, customerName ?? null, ...ids, ...(storeId != null ? [storeId] : []));
}

export function findEsimsByIds(ids: number[], storeId?: number): EsimRow[] {
  if (!ids.length) return [];
  const placeholders = ids.map(() => "?").join(",");
  const where =
    storeId != null
      ? `WHERE "id" IN (${placeholders}) AND ("storeId" = ? OR ("storeId" IS NULL AND ? = 1))`
      : `WHERE "id" IN (${placeholders})`;
  const stmt = db.prepare<unknown[], EsimRow>(
    `SELECT * FROM "Esim" ${where}`,
  );
  return stmt.all(
    ...ids,
    ...(storeId != null ? [storeId, storeId] : []),
  ) as EsimRow[];
}
