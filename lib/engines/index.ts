import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { Extraction } from "../schema";
import { claudeEngine } from "./claude";
import { codexEngine } from "./codex";
import { fixtureEngine } from "./fixture";
import { TimeoutError, type Engine, type EngineId } from "./types";

const run = promisify(execFile);

export const ENGINES: Record<EngineId, Engine> = {
  claude: claudeEngine,
  codex: codexEngine,
  fixture: fixtureEngine,
};

export async function detectEngines(): Promise<EngineId[]> {
  const available: EngineId[] = [];
  for (const id of ["claude", "codex"] as const) {
    try {
      await run("which", [id]);
      available.push(id);
    } catch {
      // not installed
    }
  }
  available.push("fixture");
  return available;
}

export function resolveEngine(setting: string | null): Engine {
  if (process.env.FINZO_ENGINE && process.env.FINZO_ENGINE in ENGINES) {
    return ENGINES[process.env.FINZO_ENGINE as EngineId];
  }
  if (setting && setting in ENGINES) return ENGINES[setting as EngineId];
  return claudeEngine;
}

/** One retry, feeding the failure back to the model so it can correct itself. */
export async function extractWithRetry(engine: Engine, filePath: string): Promise<Extraction> {
  try {
    return await engine.extract(filePath);
  } catch (err) {
    if (err instanceof TimeoutError) throw err; // retrying a timeout just times out again
    return engine.extract(filePath, err instanceof Error ? err.message : String(err));
  }
}
