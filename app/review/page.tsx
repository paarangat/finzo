import { getDb } from "@/lib/db";
import { detectEngines, resolveEngine } from "@/lib/engines";
import { ReviewDeck } from "@/components/review-deck";
import { SiteHeader } from "@/components/site-header";

export const dynamic = "force-dynamic";

export default async function Review() {
  const db = getDb();
  const deck = db.ambiguous().map(({ id, date, description, amount, suggestion }) => ({ id, date, description, amount, suggestion }));
  const available = await detectEngines();
  const engine = resolveEngine(db.getSetting("engine"));

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader active="review" reviewCount={deck.length} engine={engine} available={available} showUpload={false} />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 py-8">
        <ReviewDeck deck={deck} currency={db.currency()} />
      </main>
    </div>
  );
}
