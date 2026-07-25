"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { MarketIcon } from "@/components/MarketIcon";
import { api } from "@/lib/api";
import { requestPortfolioRefresh } from "@/lib/portfolio";
import type {
  Vault,
  VaultAsset,
  VaultDepositWithdrawResponse,
} from "@/lib/types";

type VaultListItemProps = {
  vault: Vault;
};

type VaultTab = "balance" | "position";
type VaultAction = "deposit" | "withdraw";

const QUICK_AMOUNTS = ["1", "10", "100", "1000"];

function vaultStatus(vault: Vault): { label: string; className: string } {
  if (vault.is_closed) {
    return {
      label: "Closed",
      className: "bg-slate-100 text-slate-600",
    };
  }
  if (vault.allow_deposit) {
    return {
      label: "Active",
      className: "bg-emerald-100 text-emerald-700",
    };
  }
  return {
    label: "Paused",
    className: "bg-amber-100 text-amber-700",
  };
}

function isCashAsset(asset: VaultAsset): boolean {
  return asset.market.includes("(Cash)");
}

function VaultActionDialog({
  vault,
  action,
  onClose,
}: {
  vault: Vault;
  action: VaultAction;
  onClose: () => void;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState("10");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<VaultDepositWithdrawResponse | null>(
    null,
  );

  const isDeposit = action === "deposit";
  const actionLabel = isDeposit ? "Deposit" : "Withdraw";

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = isDeposit
        ? await api.depositVault(vault.vault_address, { amount })
        : await api.withdrawVault(vault.vault_address, { shares: amount });
      setResult(response);
      requestPortfolioRefresh();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : `${actionLabel} failed`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={`vault-${vault.id}-dialog-title`}
        className="w-full max-w-md rounded-2xl border border-sky-100 bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3
              id={`vault-${vault.id}-dialog-title`}
              className="text-lg font-semibold text-slate-900"
            >
              {actionLabel}
            </h3>
            <p className="mt-1 text-sm text-slate-500">{vault.name}</p>
            <p className="mt-1 break-all font-mono text-xs text-slate-400">
              {vault.vault_address}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-700"
          >
            Close
          </button>
        </div>

        <form onSubmit={onSubmit} className="mt-5 space-y-4">
          <div>
            <label
              htmlFor={`vault-${vault.id}-${action}`}
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              {isDeposit ? "Amount (quote token)" : "Shares"}
            </label>
            <input
              id={`vault-${vault.id}-${action}`}
              type="number"
              min="0"
              step="0.000001"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
              required
              autoFocus
            />
            <div className="mt-2 flex flex-wrap gap-2">
              {QUICK_AMOUNTS.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setAmount(value)}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-600 hover:border-sky-300 hover:text-sky-700"
                >
                  {value}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className={[
              "w-full rounded-xl border px-4 py-2.5 text-sm font-medium transition disabled:opacity-50",
              isDeposit
                ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                : "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100",
            ].join(" ")}
          >
            {loading ? `${actionLabel}ing...` : actionLabel}
          </button>
        </form>

        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {result && (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            <p className="font-medium">
              {actionLabel}ed {result.amount} quote / {result.shares} shares
            </p>
            <p className="mt-1 break-all font-mono text-xs">
              Tx: {result.tx_digest}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export function VaultListItem({ vault }: VaultListItemProps) {
  const [tab, setTab] = useState<VaultTab>("balance");
  const [action, setAction] = useState<VaultAction | null>(null);

  const canDeposit = !vault.is_closed && vault.allow_deposit;
  const canWithdraw = !vault.is_closed;
  const status = vaultStatus(vault);
  const portfolio = vault.portfolio ?? [];
  const cash = portfolio.find(isCashAsset);
  const positions = portfolio.filter((asset) => !isCashAsset(asset));

  return (
    <article className="rounded-xl border border-sky-100 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-1 items-start gap-3 px-4">
          <MarketIcon iconUrl={null} question={vault.name} size="md" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-medium text-slate-900">{vault.name}</h2>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${status.className}`}
              >
                {status.label}
              </span>
            </div>
            <p className="mt-1 break-all font-mono text-xs text-slate-500">
              {vault.vault_address}
            </p>
          </div>
        </div>

        <div className="grid min-w-[280px] shrink-0 grid-cols-2 gap-2">
          <button
            type="button"
            disabled={!canDeposit}
            onClick={() => setAction("deposit")}
            className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-center transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="block text-xs font-medium text-emerald-700">
              Deposit
            </span>
          </button>
          <button
            type="button"
            disabled={!canWithdraw}
            onClick={() => setAction("withdraw")}
            className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-center transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="block text-xs font-medium text-rose-700">
              Withdraw
            </span>
          </button>
        </div>
      </div>

      {action && (
        <VaultActionDialog
          vault={vault}
          action={action}
          onClose={() => setAction(null)}
        />
      )}

      <div className="mt-5 min-w-0 overflow-x-auto border-t border-b border-slate-100 pt-4 pb-2">
        <table className="w-auto table-fixed text-left text-xs text-slate-700">
          <colgroup>
            <col className="w-[320px]" />
            <col className="w-[360px]" />
            <col className="w-[100px]" />
            <col className="w-[140px]" />
          </colgroup>
          <tbody>
            <tr className="align-top">
              <td className="px-4 py-0">
                <p className="text-slate-500">TVL</p>
                <p className="mt-1 whitespace-nowrap font-mono text-sm font-medium text-slate-900">
                  {vault.equity || "—"}
                </p>
              </td>
              <td className="px-4 py-0">
                <p className="text-slate-500">APR</p>
                <p className="mt-1 whitespace-nowrap font-mono text-sm font-medium text-slate-900">
                  —
                </p>
              </td>
              <td className="px-4 py-0">
                <p className="text-slate-500">Deposit</p>
                <p className="mt-1 whitespace-nowrap font-mono text-sm font-medium text-slate-900">
                  {vault.user_deposit || "0.00"}
                </p>
              </td>
              <td className="px-4 py-0">
                <p className="whitespace-nowrap text-slate-500">All-time earned</p>
                <p className="mt-1 whitespace-nowrap font-mono text-sm font-medium text-slate-900">
                  —
                </p>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-0 min-w-0 overflow-x-auto pt-4">
        <table className="w-auto table-fixed text-left text-xs text-slate-700">
          <colgroup>
            <col className="w-[320px]" />
            <col className="w-[360px]" />
            <col className="w-[100px]" />
            <col className="w-[140px]" />
          </colgroup>
          <tbody>
            <tr className="align-top">
              <td className="px-4 py-1.5">
                <p className="text-slate-500">Quote token</p>
                <p className="mt-1 break-all font-mono text-slate-800">
                  {vault.quote_token}
                </p>
              </td>
              <td className="px-4 py-1.5">
                <p className="text-slate-500">Vault account</p>
                <p className="mt-1 break-all font-mono text-slate-800">
                  {vault.vault_account}
                </p>
              </td>
              <td className="px-4 py-1.5" />
              <td className="px-4 py-1.5" />
            </tr>
            <tr className="align-top">
              <td className="px-4 py-1.5">
                <p className="text-slate-500">Share token</p>
                <p className="mt-1 break-all font-mono text-slate-800">
                  {vault.share_token}
                </p>
              </td>
              <td className="px-4 py-1.5">
                <p className="text-slate-500">Manager</p>
                <p className="mt-1 break-all font-mono text-slate-800">
                  {vault.manager}
                </p>
              </td>
              <td className="px-4 py-1.5" />
              <td className="px-4 py-1.5" />
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-5">
        <div className="mb-4 flex gap-1 border-b border-sky-100">
          {(
            [
              { id: "balance", label: "Balance" },
              { id: "position", label: "Position" },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={[
                "px-4 py-2 text-sm font-medium",
                tab === item.id
                  ? "border-b-2 border-sky-500 text-sky-700"
                  : "text-slate-500 hover:text-sky-700",
              ].join(" ")}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="min-w-0 overflow-x-auto">
          <table className="w-auto table-fixed text-left text-sm text-slate-800">
            <colgroup>
              <col className="w-[320px]" />
              <col className="w-[360px]" />
              <col className="w-[100px]" />
              <col className="w-[140px]" />
            </colgroup>
            <tbody>
              {tab === "balance" ? (
                cash ? (
                  <tr>
                    <td className="break-all px-4 py-3 font-mono">Cash</td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono">
                      {cash.amount}
                    </td>
                    <td className="px-4 py-3" />
                    <td className="px-4 py-3" />
                  </tr>
                ) : (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-slate-500">
                      No cash balance.
                    </td>
                  </tr>
                )
              ) : positions.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-slate-500">
                    No positions.
                  </td>
                </tr>
              ) : (
                positions.map((asset) => (
                  <tr
                    key={`${asset.market}-${asset.amount}`}
                    className="border-t border-slate-100 first:border-t-0"
                  >
                    <td className="break-all px-4 py-3 font-mono">
                      {asset.market}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono">
                      {asset.amount}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono">
                      {asset.last_price ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono">
                      {asset.quote_value ?? "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </article>
  );
}
