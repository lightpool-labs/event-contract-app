import { api } from "@/lib/api";
import type { BalanceEntry } from "@/lib/types";
import { formatUsd, sumPortfolio } from "@/lib/balances";

export default async function PortfolioPage() {
  let balances: BalanceEntry[] = [];
  let error: string | null = null;

  try {
    balances = await api.getBalances();
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load portfolio";
  }

  const positions = balances.filter(
    (b) =>
      (b.symbol === "YES" || b.symbol === "NO") &&
      (b.total !== "0" || b.locked !== "0"),
  );
  const total = sumPortfolio(balances);

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
            {positions.map((b) => (
              <tr key={b.token} className="border-t border-slate-100">
                <td className="px-4 py-3 font-medium">{b.symbol}</td>
                <td className="px-4 py-3">{b.total}</td>
                <td className="px-4 py-3">{b.locked}</td>
                <td className="px-4 py-3">{b.available}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!error && positions.length === 0 && (
          <p className="px-4 py-6 text-sm text-slate-500">No positions yet.</p>
        )}
      </div>
    </div>
  );
}
