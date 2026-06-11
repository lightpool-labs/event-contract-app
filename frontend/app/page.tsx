import { api } from "@/lib/api";
import { MarketListItem } from "@/components/MarketListItem";
import type { Market } from "@/lib/types";

export default async function HomePage() {
  let markets: Market[] = [];
  let error: string | null = null;

  try {
    markets = await api.listMarkets();
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load markets";
  }

  return (
    <div>
      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-4">
        {markets.map((market) => (
          <MarketListItem key={market.id} market={market} />
        ))}

        {!error && markets.length === 0 && (
          <p className="text-sm text-slate-500">No markets yet.</p>
        )}
      </div>
    </div>
  );
}
