import bcrypt from "bcryptjs";
import {
  createStore,
  findStoreBySlug,
  listStores,
  type StoreRow,
} from "@/lib/db";
import { getSession } from "@/lib/session";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@esim.local";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

export async function verifyAdmin(email: string, password: string): Promise<boolean> {
  if (email !== ADMIN_EMAIL || !ADMIN_PASSWORD) return false;
  return password === ADMIN_PASSWORD;
}

export async function verifyStore(slug: string, password: string): Promise<StoreRow | null> {
  const store = findStoreBySlug(slug.trim().toLowerCase());
  if (!store) return null;
  const ok = await bcrypt.compare(password, store.passwordHash);
  return ok ? store : null;
}

export async function createStoreAccount(name: string, slug: string, password: string): Promise<{ ok: boolean; error?: string }> {
  const s = slug.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  if (!s) return { ok: false, error: "帳號代碼格式不符" };
  if (findStoreBySlug(s)) return { ok: false, error: "此帳號已存在" };
  const hash = await bcrypt.hash(password, 10);
  createStore({ name, slug: s, passwordHash: hash });
  return { ok: true };
}

export async function requireStore() {
  const session = await getSession();
  if (!session.storeId || !session.storeName) return null;
  return { storeId: session.storeId, storeName: session.storeName };
}

export async function requireAdmin() {
  const session = await getSession();
  if (!session.admin) return false;
  return true;
}
