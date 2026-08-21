import type { Extraction } from "../schema";

export type EngineId = "claude" | "codex" | "fixture";

export interface Engine {
  id: EngineId;
  label: string;
  /** Extract transactions from a statement file. `feedback` carries the previous attempt's error on retry. */
  extract(filePath: string, feedback?: string): Promise<Extraction>;
}
