import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { extractWithRetry, resolveEngine } from "@/lib/engines";

const ALLOWED = [".pdf", ".csv"];

export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
  }
  const ext = path.extname(file.name).toLowerCase();
  if (!ALLOWED.includes(ext)) {
    return NextResponse.json({ error: `Unsupported file type "${ext}". Upload a PDF or CSV statement.` }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const fileHash = createHash("sha256").update(bytes).digest("hex");
  const db = getDb();
  if (db.hasStatement(fileHash)) {
    return NextResponse.json({ error: "This statement was already uploaded." }, { status: 409 });
  }

  const uploadsDir = path.join(process.cwd(), "data", "uploads");
  await mkdir(uploadsDir, { recursive: true });
  const filePath = path.join(uploadsDir, `${fileHash.slice(0, 12)}${ext}`);
  await writeFile(filePath, bytes);

  const engine = resolveEngine(db.getSetting("engine"));
  try {
    const extraction = await extractWithRetry(engine, filePath);
    const result = db.insertStatement(extraction, file.name, fileHash);
    return NextResponse.json({ ok: true, month: extraction.period_end.slice(0, 7), ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Extraction with ${engine.label} failed.`, detail: message }, { status: 502 });
  }
}
