-- CreateTable
CREATE TABLE "Esim" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
