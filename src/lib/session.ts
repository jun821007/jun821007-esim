import { getIronSession } from "iron-session";
import { cookies } from "next/headers";

export type SessionData = {
  storeId?: number;
  storeName?: string;
  admin?: boolean;
};

const SESSION_OPTIONS = {
  password:
    process.env.SESSION_SECRET ||
    "change-me-in-production-at-least-32-chars-long",
  cookieName: "esim-session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 7, // 7 days
  },
};

export async function getSession() {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, SESSION_OPTIONS);
}
