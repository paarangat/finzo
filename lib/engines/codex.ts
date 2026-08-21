import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { parseModelJson, validateExtraction, type Extraction } from "../schema";
import { buildExtractionPrompt } from "./prompt";
import type { Engine } from "./types";

const run = promisify(execFile);

export const codexEngine: Engine = {
  id: "codex",
  label: "Codex",
  async extract(filePath: string, feedback?: string): Promise<Extraction> {
    const outDir = await mkdtemp(path.join(tmpdir(), "finzo-codex-"));
    const outFile = path.join(outDir, "last-message.txt");
    try {
      await run(
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
        { timeout: 180_000, maxBuffer: 32 * 1024 * 1024 }
      );
      const text = await readFile(outFile, "utf8");
      return validateExtraction(parseModelJson(text));
    } finally {
      await rm(outDir, { recursive: true, force: true });
    }
  },
};
