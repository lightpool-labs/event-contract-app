"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import type { Event, MintBurnResponse } from "@/lib/types";

type MintBurnMode = "mint" | "burn";

type MintBurnFormProps = {
  event: Event;
  mode: MintBurnMode;
};

export function MintBurnForm({ event, mode }: MintBurnFormProps) {
  const [amount, setAmount] = useState("10");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MintBurnResponse | null>(null);

  const isMint = mode === "mint";
  const actionLabel = isMint ? "Mint" : "Burn";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = isMint
        ? await api.mintEvent(event.slug, { amount })
        : await api.burnEvent(event.slug, { amount });
      setResult(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : `${actionLabel} failed`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-lg">
      <form
        onSubmit={onSubmit}
        className="space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div>
          <label htmlFor="amount" className="mb-1 block text-sm font-medium text-slate-700">
            Amount (complete sets)
          </label>
          <input
            id="amount"
            type="number"
            min="0"
            step="0.000001"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            required
          />
          <p className="mt-1 text-xs text-slate-500">
            {isMint
              ? "Deposit collateral to mint equal YES and NO tokens."
              : "Burn equal YES and NO tokens to recover collateral."}
          </p>
        </div>

        <div className="rounded border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          <p className="break-all font-mono">Event: {event.market_address}</p>
          <p className="mt-1 break-all font-mono">Collateral: {event.collateral_token}</p>
          <p className="mt-1 break-all font-mono">YES token: {event.yes_token}</p>
          <p className="mt-1 break-all font-mono">NO token: {event.no_token}</p>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
        >
          {loading ? `${actionLabel}ing...` : `${actionLabel} complete set`}
        </button>
      </form>

      {error && (
        <div className="mt-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-4 rounded border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <p className="font-medium">
            {actionLabel}ed {result.amount} complete set(s)
          </p>
          <p className="mt-2 break-all font-mono text-xs">Tx: {result.tx_digest}</p>
        </div>
      )}
    </div>
  );
}
