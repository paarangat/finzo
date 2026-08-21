import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { parseModelJson, validateExtraction, type Extraction } from "../schema";
import { buildExtractionPrompt } from "./prompt";
import type { Engine } from "./types";

const run = promisify(execFile);

export const claudeEngine: Engine = {
  id: "claude",
  label: "Claude Code",
  async extract(filePath: string, feedback?: string): Promise<Extraction> {
    const { stdout } = await run(
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
      { timeout: 180_000, maxBuffer: 32 * 1024 * 1024 }
    );
    // --output-format json wraps the reply: { result: "<model text>", ... }
    const wrapper = JSON.parse(stdout) as { result?: string; is_error?: boolean };
    if (wrapper.is_error || typeof wrapper.result !== "string") {
      throw new Error(`claude CLI returned an error: ${stdout.slice(0, 500)}`);
    }
    return validateExtraction(parseModelJson(wrapper.result));
  },
};
