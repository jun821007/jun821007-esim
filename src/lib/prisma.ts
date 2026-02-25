import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

// 防止外部環境把 PRISMA_CLIENT_ENGINE_TYPE 設成 "client"
// 這裡強制讓 Prisma 用預設的 binary engine。
process.env.PRISMA_CLIENT_ENGINE_TYPE = "binary";

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

