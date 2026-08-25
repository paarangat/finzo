"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * "Good evening, Paarangat" — click the name to change it. With no name stored
 * (any database that predates onboarding) this is how you set one.
 */
export function Greeting({ greeting, name }: { greeting: string; name: string | null }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name ?? "");
  const [busy, setBusy] = useState(false);

  if (editing) {
    return (
      <form
        className="flex items-center gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          const trimmed = value.trim();
          if (!trimmed) return;
          setBusy(true);
          await fetch("/api/settings", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: trimmed }),
          });
          setBusy(false);
          setEditing(false);
          router.refresh();
        }}
      >
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Your name"
          maxLength={60}
          autoFocus
          required
          className="h-9 w-48 rounded-lg border border-zinc-300 bg-transparent px-3 text-lg outline-none focus:border-accent dark:border-zinc-700"
          aria-label="Your name"
        />
        <button
          type="submit"
          disabled={busy}
          className="h-9 rounded-lg bg-accent-solid px-3.5 text-sm font-medium text-accent-solid-fg transition-colors hover:bg-accent-solid-hover disabled:opacity-50"
        >
          Save
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="text-xs text-zinc-500 transition-colors hover:text-foreground"
        >
          Cancel
        </button>
      </form>
    );
  }

  return (
    <h1 className="text-lg font-semibold tracking-tight">
      {greeting}
      {name ? (
        <>
          ,{" "}
          <button onClick={() => setEditing(true)} title="Change your name" className="transition-colors hover:text-accent">
            {name}
          </button>
        </>
      ) : (
        <>
          {" · "}
          <button
            onClick={() => setEditing(true)}
            className="text-sm font-normal text-accent transition-colors hover:underline"
          >
            Add your name
          </button>
        </>
      )}
    </h1>
  );
}
