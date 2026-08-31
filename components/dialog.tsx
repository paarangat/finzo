"use client";

import { useEffect, useRef } from "react";

/** Native <dialog> modal: backdrop, Escape, and focus trapping come free. */
export function Dialog({
  open,
  onClose,
  title,
  width = "max-w-sm",
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  width?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (open) ref.current?.showModal();
    else ref.current?.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      className={`m-auto w-full ${width} rounded-2xl border border-zinc-200 bg-background p-6 text-foreground shadow-lg dark:border-zinc-800`}
    >
      <h2 className="mb-4 text-sm font-medium">{title}</h2>
      {open && children}
    </dialog>
  );
}
