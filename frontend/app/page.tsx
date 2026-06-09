import Link from "next/link";
import { api } from "@/lib/api";
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
        <div className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-4">
        {markets.map((market) => (
          <Link
            key={market.id}
            href={`/markets/${market.id}`}
            className="block rounded-lg border border-slate-200 bg-white p-4 shadow-sm hover:border-slate-300"
          >
            <div className="mb-2 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="font-medium">{market.question}</h2>
                <p className="mt-1 break-all font-mono text-xs text-slate-500">
                  {market.market_address}
                </p>
              </div>
              <span className="shrink-0 rounded bg-emerald-100 px-2 py-1 text-xs text-emerald-700">
                {market.state}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Deadline: {new Date(market.resolution_deadline * 1000).toLocaleString()}
            </p>
          </Link>
        ))}

        {!error && markets.length === 0 && (
          <p className="text-sm text-slate-500">No markets yet.</p>
        )}
      </div>
    </div>
  );
}
