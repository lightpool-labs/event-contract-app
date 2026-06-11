import { api } from "@/lib/api";
import type { BalanceEntry, Market } from "@/lib/types";
import { formatUsd, sumCash } from "@/lib/balances";

export default async function CashPage() {
  let balances: BalanceEntry[] = [];
  let markets: Market[] = [];
  let error: string | null = null;

  try {
    [balances, markets] = await Promise.all([api.getBalances(), api.listMarkets()]);
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load cash balance";
  }

  const total = sumCash(balances, markets);
  const cashBalances = balances.filter(
    (balance) => balance.symbol !== "YES" && balance.symbol !== "NO",
  );

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
              <th className="px-4 py-3">Symbol</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3">Locked</th>
              <th className="px-4 py-3">Available</th>
            </tr>
          </thead>
          <tbody>
            {cashBalances.map((b) => (
              <tr key={b.token} className="border-t border-slate-100">
                <td className="px-4 py-3 font-medium">{b.symbol}</td>
                <td className="px-4 py-3">{b.total}</td>
                <td className="px-4 py-3">{b.locked}</td>
                <td className="px-4 py-3">{b.available}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!error && cashBalances.length === 0 && (
          <p className="px-4 py-6 text-sm text-slate-500">No cash balance yet.</p>
        )}
      </div>
    </div>
  );
}
