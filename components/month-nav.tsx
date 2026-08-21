import Link from "next/link";
import { CaretLeft, CaretRight } from "@phosphor-icons/react/dist/ssr";
import { formatMonth } from "@/lib/format";

export function MonthNav({ months, current }: { months: string[]; current: string }) {
  const i = months.indexOf(current);
  const newer = i > 0 ? months[i - 1] : null; // months are sorted newest first
  const older = i < months.length - 1 ? months[i + 1] : null;
  const linkCls = "rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800";
  const disabledCls = "p-1.5 text-zinc-300 dark:text-zinc-700";

  return (
    <div className="flex items-center gap-1">
      {older ? (
        <Link href={`/?month=${older}`} className={linkCls} aria-label="Previous month">
          <CaretLeft size={16} />
        </Link>
      ) : (
        <span className={disabledCls}>
          <CaretLeft size={16} />
        </span>
      )}
      <h1 className="min-w-32 text-center text-lg font-semibold tracking-tight">{formatMonth(current)}</h1>
      {newer ? (
        <Link href={`/?month=${newer}`} className={linkCls} aria-label="Next month">
          <CaretRight size={16} />
        </Link>
      ) : (
        <span className={disabledCls}>
          <CaretRight size={16} />
        </span>
      )}
    </div>
  );
}
