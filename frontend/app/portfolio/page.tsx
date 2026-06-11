import type { BalanceEntry, BookResponse, Market } from "@/lib/types";
import {
  findPositionMeta,
  formatUsd,
  getPositionBalances,
  positionUsdValue,
} from "@/lib/balances";
import { loadPortfolioSummary } from "@/lib/portfolio";

function outcomeLabel(outcome: string): string {
  if (outcome === "yes") {
    return "Yes";
  }
  if (outcome === "no") {
    return "No";
  }
  return outcome;
}

export default async function PortfolioPage() {
  let balances: BalanceEntry[] = [];
  let markets: Market[] = [];
  let booksBySpotMarket = new Map<string, BookResponse>();
  let total = 0;
  let error: string | null = null;

  try {
    const summary = await loadPortfolioSummary();
    balances = summary.balances;
    markets = summary.markets;
    booksBySpotMarket = summary.booksBySpotMarket;
    total = summary.portfolio;
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load portfolio";
  }

  const positions = getPositionBalances(balances, markets);

  return (
    <div>
      <p className="mb-4 text-2xl font-semibold">${formatUsd(total)}</p>

      {error && (
        <div className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100 text-left">
            <tr>
              <th className="px-4 py-3">Outcome</th>
              <th className="px-4 py-3">Shares</th>
              <th className="px-4 py-3">Value</th>
              <th className="px-4 py-3">Locked</th>
              <th className="px-4 py-3">Available</th>
            </tr>
          </thead>
          <tbody>
            {positions.map((balance) => {
              const meta = findPositionMeta(balance.token, markets);
              const value = positionUsdValue(balance, markets, booksBySpotMarket);

              return (
                <tr key={balance.token} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium">
                    {meta ? (
                      <>
                        {meta.question}{" "}
                        <span>[{outcomeLabel(meta.outcome)}]</span>
                      </>
                    ) : (
                      balance.symbol
                    )}
                  </td>
                  <td className="px-4 py-3">{balance.total}</td>
                  <td className="px-4 py-3">${formatUsd(value)}</td>
                  <td className="px-4 py-3">{balance.locked}</td>
                  <td className="px-4 py-3">{balance.available}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!error && positions.length === 0 && (
          <p className="px-4 py-6 text-sm text-slate-500">No positions yet.</p>
        )}
      </div>
    </div>
  );
}
