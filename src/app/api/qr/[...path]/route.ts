import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path: pathSegments } = await params;
  const fileName = pathSegments?.join("/");
  if (!fileName || fileName.includes("..")) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  const baseDir =
    process.env.DATABASE_PATH && path.isAbsolute(process.env.DATABASE_PATH)
      ? path.dirname(process.env.DATABASE_PATH)
      : path.join(process.cwd(), "public");
  const filePath = path.join(baseDir, "qr", fileName);

  try {
    const buffer = await fs.readFile(filePath);
    const ext = path.extname(fileName).toLowerCase();
    const contentTypes: Record<string, string> = {
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".gif": "image/gif",
      ".webp": "image/webp",
    };
    const contentType = contentTypes[ext] || "application/octet-stream";

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}