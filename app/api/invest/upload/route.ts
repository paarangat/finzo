import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { buildCasPrompt, validateCas, type CasExtraction } from "@/lib/cas";
import { getDb, toMinor } from "@/lib/db";
import { resolveEngine } from "@/lib/engines";
import { TimeoutError, type Engine } from "@/lib/engines/types";
import { findSchemeCode } from "@/lib/nav";
import { parseModelJson } from "@/lib/schema";

async function extractCas(engine: Engine, filePath: string): Promise<CasExtraction> {
  const dir = path.dirname(filePath);
  try {
    return validateCas(parseModelJson(await engine.run(buildCasPrompt(filePath), dir)));
  } catch (err) {
    if (err instanceof TimeoutError) throw err;
    const feedback = err instanceof Error ? err.message : String(err);
    return validateCas(parseModelJson(await engine.run(buildCasPrompt(filePath, feedback), dir)));
  }
}

export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
  }
  const ext = path.extname(file.name).toLowerCase();
  if (ext !== ".pdf") {
    return NextResponse.json({ error: `Unsupported file type "${ext}". Upload the CAS as a PDF.` }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const fileHash = createHash("sha256").update(bytes).digest("hex");
  const uploadsDir = path.join(process.cwd(), "data", "uploads");
  await mkdir(uploadsDir, { recursive: true });
  const filePath = path.join(uploadsDir, `cas-${fileHash.slice(0, 12)}.pdf`);
  await writeFile(filePath, bytes);

  const db = getDb();
  const engine = resolveEngine(db.getSetting("engine"));
  try {
    const cas = await extractCas(engine, filePath);
    let inserted = 0;
    let updated = 0;
    let matched = 0;
    for (const h of cas.holdings) {
      // Only mutual funds with a unit count can be auto-priced from the AMFI feed.
      const schemeCode = h.kind.startsWith("mf_") && h.units !== null ? await findSchemeCode(h.name) : null;
      if (schemeCode !== null) matched++;
      const res = db.upsertHolding({
        name: h.name,
        kind: h.kind,
        value: toMinor(h.value),
        invested: h.invested === null ? null : toMinor(h.invested),
        units: h.units,
        scheme_code: schemeCode,
      });
      if (res === "inserted") inserted++;
      else updated++;
    }
    return NextResponse.json({ ok: true, inserted, updated, matched, total: cas.holdings.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        error: `Reading the CAS with ${engine.label} failed. If the PDF is password-protected (CAMS/KFintech email ones usually are), remove the password first and re-upload.`,
        detail: message,
      },
      { status: 502 }
    );
  }
}
