import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { parseModelJson, validateExtraction, type Extraction } from "../schema";
import { buildExtractionPrompt } from "./prompt";
import { EXTRACTION_TIMEOUT_MS, TimeoutError } from "./types";
import type { Engine } from "./types";

const run = promisify(execFile);

export const codexEngine: Engine = {
  id: "codex",
  label: "Codex",
  async extract(filePath: string, feedback?: string): Promise<Extraction> {
    const outDir = await mkdtemp(path.join(tmpdir(), "finzo-codex-"));
    const outFile = path.join(outDir, "last-message.txt");
    try {
      const pending = run(
        "codex",
        [
          "exec",
          "--sandbox",
          "read-only",
          "--cd",
          path.dirname(filePath),
          "--output-last-message",
          outFile,
          buildExtractionPrompt(filePath, feedback),
        ],
        { timeout: EXTRACTION_TIMEOUT_MS, maxBuffer: 32 * 1024 * 1024 }
      );
      pending.child.stdin?.end();
      try {
        await pending;
      } catch (err) {
        const e = err as { killed?: boolean; stderr?: string; message?: string };
        if (e.killed) throw new TimeoutError(`codex CLI timed out after ${EXTRACTION_TIMEOUT_MS / 60000} minutes.`);
        throw new Error(`codex CLI failed: ${(e.stderr || e.message || "").slice(-800)}`);
      }
      const text = await readFile(outFile, "utf8");
      return validateExtraction(parseModelJson(text));
    } finally {
      await rm(outDir, { recursive: true, force: true });
    }
  },
};
