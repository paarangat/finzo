"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { UploadSimple } from "@phosphor-icons/react";

type Status = { state: "idle" } | { state: "uploading" } | { state: "error"; message: string; detail?: string };

export function Uploader({ variant, engineLabel }: { variant: "button" | "dropzone"; engineLabel: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>({ state: "idle" });
  const [dragging, setDragging] = useState(false);

  async function upload(file: File) {
    setStatus({ state: "uploading" });
    const body = new FormData();
    body.append("file", file);
    try {
      const res = await fetch("/api/upload", { method: "POST", body });
      const json = await res.json();
      if (!res.ok) {
        setStatus({ state: "error", message: json.error ?? "Upload failed.", detail: json.detail });
        return;
      }
      setStatus({ state: "idle" });
      router.push(`/?month=${json.month}`);
      router.refresh();
    } catch (err) {
      setStatus({ state: "error", message: err instanceof Error ? err.message : "Upload failed." });
    }
  }

  const input = (
    <input
      ref={inputRef}
      type="file"
      accept=".pdf,.csv"
      className="hidden"
      onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
    />
  );

  if (variant === "button") {
    return (
      <div className="flex items-center gap-3">
        {input}
        {status.state === "error" && <span className="text-sm text-red-600 dark:text-red-400">{status.message}</span>}
        <button
          onClick={() => inputRef.current?.click()}
          disabled={status.state === "uploading"}
          className="inline-flex items-center gap-2 whitespace-nowrap rounded-lg bg-emerald-700 px-3.5 py-2 text-sm font-medium text-white transition active:scale-[0.98] hover:bg-emerald-800 disabled:opacity-60"
        >
          <UploadSimple size={16} weight="bold" />
          {status.state === "uploading" ? "Reading statement…" : "Upload statement"}
        </button>
      </div>
    );
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (e.dataTransfer.files?.[0]) upload(e.dataTransfer.files[0]);
      }}
      className={`flex w-full max-w-lg flex-col items-center gap-4 rounded-xl border border-dashed px-8 py-14 text-center transition-colors ${
        dragging ? "border-accent bg-accent/5" : "border-zinc-300 dark:border-zinc-700"
      }`}
    >
      {input}
      {status.state === "uploading" ? (
        <>
          <div className="size-8 animate-pulse rounded-lg bg-accent/20" />
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {engineLabel} is reading your statement. This can take a few minutes for long statements.
          </p>
        </>
      ) : (
        <>
          <UploadSimple size={28} className="text-zinc-400" />
          <div>
            <p className="font-medium">Drop a bank statement here</p>
            <p className="mt-1 text-sm text-zinc-500">PDF or CSV. It never leaves this machine except through your own {engineLabel} subscription.</p>
          </div>
          <button
            onClick={() => inputRef.current?.click()}
            className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white transition active:scale-[0.98] hover:bg-emerald-800"
          >
            Choose file
          </button>
          {status.state === "error" && (
            <div className="text-sm text-red-600 dark:text-red-400">
              <p>{status.message}</p>
              {status.detail && (
                <details className="mt-1 text-left text-xs text-zinc-500">
                  <summary className="cursor-pointer">Engine output</summary>
                  <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap">{status.detail}</pre>
                </details>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
