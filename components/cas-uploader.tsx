"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { UploadSimple } from "@phosphor-icons/react";

type Status =
  | { state: "idle" }
  | { state: "uploading" }
  | { state: "done"; message: string }
  | { state: "error"; message: string; detail?: string };

export function CasUploader({ engineLabel }: { engineLabel: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>({ state: "idle" });

  async function upload(file: File) {
    setStatus({ state: "uploading" });
    const body = new FormData();
    body.append("file", file);
    try {
      const res = await fetch("/api/invest/upload", { method: "POST", body });
      const json = await res.json();
      if (!res.ok) {
        setStatus({ state: "error", message: json.error ?? "Upload failed.", detail: json.detail });
        return;
      }
      setStatus({
        state: "done",
        message: `${json.total} ${json.total === 1 ? "holding" : "holdings"} imported (${json.updated} refreshed, ${json.matched} priced from the NAV feed).`,
      });
      router.refresh();
    } catch (err) {
      setStatus({ state: "error", message: err instanceof Error ? err.message : "Upload failed." });
    }
  }

  return (
    <div className="rounded-xl border border-dashed border-zinc-300 p-5 dark:border-zinc-700">
      <input ref={inputRef} type="file" accept=".pdf" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="max-w-xl">
          <p className="text-sm font-medium">Import from your CAS</p>
          <p className="mt-1 text-xs leading-relaxed text-zinc-500">
            Get a Consolidated Account Statement from CAMS/KFintech (mutual funds) or NSDL/CDSL (demat + NPS) and drop it here —
            {" "}{engineLabel} reads out every holding, and mutual funds re-price daily from AMFI&apos;s public NAV feed. If the PDF
            has a password, remove it first.
          </p>
        </div>
        <button
          onClick={() => inputRef.current?.click()}
          disabled={status.state === "uploading"}
          className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg bg-accent-solid px-3.5 text-sm font-medium text-accent-solid-fg transition active:scale-[0.98] hover:bg-accent-solid-hover disabled:opacity-60"
        >
          <UploadSimple size={16} weight="bold" />
          {status.state === "uploading" ? "Reading CAS…" : "Upload CAS"}
        </button>
      </div>
      {status.state === "uploading" && (
        <p className="mt-3 text-xs text-zinc-500">{engineLabel} is reading your statement — this can take a few minutes.</p>
      )}
      {status.state === "done" && <p className="mt-3 text-xs text-accent">{status.message}</p>}
      {status.state === "error" && (
        <div className="mt-3 text-xs text-red-600 dark:text-red-400">
          <p>{status.message}</p>
          {status.detail && (
            <details className="mt-1 text-zinc-500">
              <summary className="cursor-pointer">Engine output</summary>
              <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap">{status.detail}</pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
