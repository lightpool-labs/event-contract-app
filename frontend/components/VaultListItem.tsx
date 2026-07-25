"use client";

import type { Vault } from "@/lib/types";

type VaultListItemProps = {
  vault: Vault;
};

export function VaultListItem({ vault }: VaultListItemProps) {
  const canDeposit = !vault.is_closed && vault.allow_deposit;
  const canWithdraw = !vault.is_closed;
  const portfolio = vault.portfolio ?? [];

  return (
    <article className="rounded-xl border border-sky-100 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1 overflow-x-auto">
          <table className="w-auto table-fixed text-left text-xs text-slate-700">
            <colgroup>
              <col className="w-[320px]" />
              <col className="w-[360px]" />
              <col className="w-[88px]" />
              <col className="w-[96px]" />
            </colgroup>
            <tbody>
              <tr className="border-b border-slate-50 align-top">
                <td className="py-1.5 pr-4">
                  <p className="text-slate-500">Vault</p>
                  <p className="mt-1 break-all font-mono text-slate-800">
                    {vault.vault_address}
                  </p>
                </td>
                <td className="py-1.5 pr-4">
                  <p className="text-slate-500">Equity</p>
                  <p className="mt-1 whitespace-nowrap font-mono text-slate-800">
                    {vault.equity || "—"}
                  </p>
                </td>
                <td className="py-1.5 pr-4" />
                <td className="py-1.5" />
              </tr>
              <tr className="border-b border-slate-50 align-top">
                <td className="py-1.5 pr-4">
                  <p className="text-slate-500">Quote token</p>
                  <p className="mt-1 break-all font-mono text-slate-800">
                    {vault.quote_token}
                  </p>
                </td>
                <td className="py-1.5 pr-4">
                  <p className="text-slate-500">Vault account</p>
                  <p className="mt-1 whitespace-nowrap font-mono text-slate-800">
                    {vault.vault_account}
                  </p>
                </td>
                <td className="py-1.5 pr-4" />
                <td className="py-1.5" />
              </tr>
              <tr className="border-b border-slate-50 align-top">
                <td className="py-1.5 pr-4">
                  <p className="text-slate-500">Share token</p>
                  <p className="mt-1 break-all font-mono text-slate-800">
                    {vault.share_token}
                  </p>
                </td>
                <td className="py-1.5 pr-4">
                  <p className="text-slate-500">Manager</p>
                  <p className="mt-1 whitespace-nowrap font-mono text-slate-800">
                    {vault.manager}
                  </p>
                </td>
                <td className="py-1.5 pr-4" />
                <td className="py-1.5" />
              </tr>

              {portfolio.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-2 text-sm text-slate-500">
                    No holdings.
                  </td>
                </tr>
              ) : (
                <>
                  <tr className="border-b border-slate-100 text-slate-500">
                    <th className="py-1.5 pr-4 font-medium">Asset</th>
                    <th className="py-1.5 pr-4 font-medium">Amount</th>
                    <th className="py-1.5 pr-4 font-medium">Last price</th>
                    <th className="py-1.5 font-medium">Quote value</th>
                  </tr>
                  {portfolio.map((asset) => (
                    <tr
                      key={`${asset.market}-${asset.amount}`}
                      className="border-b border-slate-50 align-top"
                    >
                      <td className="py-1.5 pr-4 font-mono break-all">
                        {asset.market}
                      </td>
                      <td className="py-1.5 pr-4 whitespace-nowrap font-mono">
                        {asset.amount}
                      </td>
                      <td className="py-1.5 pr-4 whitespace-nowrap font-mono">
                        {asset.last_price ?? "—"}
                      </td>
                      <td className="py-1.5 whitespace-nowrap font-mono">
                        {asset.quote_value ?? "—"}
                      </td>
                    </tr>
                  ))}
                </>
              )}
            </tbody>
          </table>
        </div>

        <div className="grid min-w-[280px] shrink-0 grid-cols-2 gap-2 self-end">
          <button
            type="button"
            disabled={!canDeposit}
            className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-center transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="block text-xs font-medium text-emerald-700">
              Deposit
            </span>
          </button>
          <button
            type="button"
            disabled={!canWithdraw}
            className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-center transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="block text-xs font-medium text-rose-700">
              Withdraw
            </span>
          </button>
        </div>
      </div>
    </article>
  );
}
