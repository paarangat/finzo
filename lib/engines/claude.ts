import { execFile, type ExecFileException } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { parseModelJson, validateExtraction, type Extraction } from "../schema";
import { buildExtractionPrompt } from "./prompt";
import { EXTRACTION_TIMEOUT_MS, TimeoutError } from "./types";
import type { Engine } from "./types";

const run = promisify(execFile);

export const claudeEngine: Engine = {
  id: "claude",
  label: "Claude Code",
  async extract(filePath: string, feedback?: string): Promise<Extraction> {
    const pending = run(
      "claude",
      [
        "-p",
        buildExtractionPrompt(filePath, feedback),
        "--output-format",
        "json",
        "--allowedTools",
        "Read",
        "--add-dir",
        path.dirname(filePath),
      ],
      { timeout: EXTRACTION_TIMEOUT_MS, maxBuffer: 32 * 1024 * 1024 }
    );
    pending.child.stdin?.end(); // claude waits 3s for piped stdin otherwise

    let stdout: string;
    try {
      ({ stdout } = await pending);
    } catch (err) {
      const e = err as ExecFileException & { stderr?: string; stdout?: string };
      if (e.killed) throw new TimeoutError(`claude CLI timed out after ${EXTRACTION_TIMEOUT_MS / 60000} minutes.`);
      throw new Error(`claude CLI failed: ${(e.stderr || e.stdout || e.message || "").slice(-800)}`);
    }

    // --output-format json wraps the reply: { result: "<model text>", ... }
    const wrapper = JSON.parse(stdout) as { result?: string; is_error?: boolean };
    if (wrapper.is_error || typeof wrapper.result !== "string") {
      throw new Error(`claude CLI returned an error: ${stdout.slice(0, 500)}`);
    }
    return validateExtraction(parseModelJson(wrapper.result));
  },
};
