import type { Extraction } from "../schema";

// Real multi-page statements routinely take several minutes of CLI read+extract.
export const EXTRACTION_TIMEOUT_MS = 10 * 60_000;

/** Thrown when the CLI hits the timeout; retrying would just time out again. */
export class TimeoutError extends Error {}

export type EngineId = "claude" | "codex" | "fixture";

export interface Engine {
  id: EngineId;
  label: string;
  /** Extract transactions from a statement file. `feedback` carries the previous attempt's error on retry. */
  extract(filePath: string, feedback?: string): Promise<Extraction>;
}
