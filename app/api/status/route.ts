import { statSync } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";

// Any write from any connection touches the db or its WAL file, so mtimes
// are a cheap "did anything change" version for the dashboard poller.
export async function GET() {
  const dir = path.join(process.cwd(), "data");
  const mtime = (f: string) => {
    try {
      return statSync(path.join(dir, f)).mtimeMs;
    } catch {
      return 0;
    }
  };
  return NextResponse.json({ v: `${mtime("finzo.db")}-${mtime("finzo.db-wal")}` });
}
