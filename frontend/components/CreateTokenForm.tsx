"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import type { CreateTokenResponse } from "@/lib/types";

export function CreateTokenForm() {
  const [name, setName] = useState("USD Tether");
  const [symbol, setSymbol] = useState("USDT");
  const [totalSupply, setTotalSupply] = useState("1000000");
  const [mintable, setMintable] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CreateTokenResponse | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    const supply = Number(totalSupply);
    if (!Number.isFinite(supply) || supply <= 0) {
      setError("Total supply must be a positive number.");
      setLoading(false);
      return;
    }

    try {
      const response = await api.createToken({
        name: name.trim(),
        symbol: symbol.trim(),
        total_supply: supply,
        mintable,
      });
      setResult(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create token");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-lg">
      <form onSubmit={onSubmit} className="space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <label htmlFor="name" className="mb-1 block text-sm font-medium text-slate-700">
            Name
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            required
          />
        </div>

        <div>
          <label htmlFor="symbol" className="mb-1 block text-sm font-medium text-slate-700">
            Symbol
          </label>
          <input
            id="symbol"
            type="text"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm uppercase"
            required
          />
        </div>

        <div>
          <label htmlFor="totalSupply" className="mb-1 block text-sm font-medium text-slate-700">
            Total supply
          </label>
          <input
            id="totalSupply"
            type="number"
            min="1"
            step="1"
            value={totalSupply}
            onChange={(e) => setTotalSupply(e.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            required
          />
          <p className="mt-1 text-xs text-slate-500">Whole token units (6 decimals on chain).</p>
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={mintable}
            onChange={(e) => setMintable(e.target.checked)}
          />
          Mintable
        </label>

        <button
          type="submit"
          disabled={loading}
          className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {loading ? "Creating..." : "Create token"}
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
            Created {result.symbol} ({result.name})
          </p>
          <p className="mt-2 break-all font-mono text-xs">Token: {result.token_address}</p>
          <p className="mt-1 break-all font-mono text-xs">Tx: {result.tx_digest}</p>
          <p className="mt-1 text-xs">Creator: {result.creator}</p>
        </div>
      )}
    </div>
  );
}
