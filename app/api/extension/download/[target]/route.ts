import { access, readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { getExtensionDownload } from "@/lib/extension/downloads";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ target: string }> }
) {
  const { target } = await params;
  const download = getExtensionDownload(target);

  if (!download) {
    return NextResponse.json({ error: "不支持的浏览器版本" }, { status: 404 });
  }

  const filePath = path.join(process.cwd(), "extension", download.sourceFile);

  try {
    await access(filePath);
  } catch {
    return NextResponse.json(
      { error: `${download.label} 插件包正在准备中` },
      { status: 404 }
    );
  }

  const file = await readFile(filePath);

  return new Response(new Uint8Array(file), {
    headers: {
      "Content-Type": download.contentType,
      "Content-Disposition": `attachment; filename="${download.downloadName}"`,
      "Content-Length": String(file.length),
      "Cache-Control": "no-store",
    },
  });
}
