"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import type { CreateEventContractResponse } from "@/lib/types";
import { MarketIcon } from "@/components/MarketIcon";

function defaultDeadline(): string {
  const date = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function CreateEventContractForm() {
  const [question, setQuestion] = useState("Will BTC reach 100k by end of 2026?");
  const [iconUrl, setIconUrl] = useState("");
  const [collateralToken, setCollateralToken] = useState("");
  const [resolutionDeadline, setResolutionDeadline] = useState(defaultDeadline);
  const [tickSize, setTickSize] = useState("0.01");
  const [minOrderSize, setMinOrderSize] = useState("0.1");
  const [makerFeeBps, setMakerFeeBps] = useState("10");
  const [takerFeeBps, setTakerFeeBps] = useState("20");
  const [allowMarketOrders, setAllowMarketOrders] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CreateEventContractResponse | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    const deadlineMs = Date.parse(resolutionDeadline);
    if (Number.isNaN(deadlineMs)) {
      setError("Resolution deadline is invalid.");
      setLoading(false);
      return;
    }

    const tick = Number(tickSize);
    const minSize = Number(minOrderSize);
    const makerFee = Number(makerFeeBps);
    const takerFee = Number(takerFeeBps);

    if (!collateralToken.trim()) {
      setError("Collateral token address is required.");
      setLoading(false);
      return;
    }

    try {
      const response = await api.createEventContract({
        question: question.trim(),
        icon_url: iconUrl.trim() || undefined,
        collateral_token: collateralToken.trim(),
        resolution_deadline: Math.floor(deadlineMs / 1000),
        tick_size: Math.round(tick * 1_000_000),
        min_order_size: Math.round(minSize * 1_000_000),
        maker_fee_bps: makerFee,
        taker_fee_bps: takerFee,
        allow_market_orders: allowMarketOrders,
      });
      setResult(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create event contract");
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
          <label htmlFor="question" className="mb-1 block text-sm font-medium text-slate-700">
            Question
          </label>
          <textarea
            id="question"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={3}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            required
          />
        </div>

        <div>
          <label htmlFor="iconUrl" className="mb-1 block text-sm font-medium text-slate-700">
            Market icon
          </label>
          <div className="flex items-start gap-3">
            <MarketIcon iconUrl={iconUrl || null} question={question} size="md" />
            <div className="min-w-0 flex-1 space-y-2">
              <input
                id="iconUrl"
                type="url"
                value={iconUrl.startsWith("data:") ? "" : iconUrl}
                onChange={(e) => setIconUrl(e.target.value)}
                placeholder="https://example.com/icon.png"
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                id="iconFile"
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) {
                    return;
                  }
                  const reader = new FileReader();
                  reader.onload = () => {
                    if (typeof reader.result === "string") {
                      setIconUrl(reader.result);
                    }
                  };
                  reader.readAsDataURL(file);
                }}
                className="block w-full text-xs text-slate-600 file:mr-3 file:rounded file:border-0 file:bg-sky-50 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-sky-700"
              />
              <p className="text-xs text-slate-500">
                Upload an image or paste an icon URL. Shown before the question on market pages.
              </p>
            </div>
          </div>
        </div>

        <div>
          <label
            htmlFor="collateralToken"
            className="mb-1 block text-sm font-medium text-slate-700"
          >
            Collateral token address
          </label>
          <input
            id="collateralToken"
            type="text"
            value={collateralToken}
            onChange={(e) => setCollateralToken(e.target.value)}
            placeholder="0x0200000000000007 or 7"
            className="w-full rounded border border-slate-300 px-3 py-2 font-mono text-xs"
            required
          />
          <p className="mt-1 text-xs text-slate-500">
            Paste the full token contract from Create Token (e.g. 0x0200000000000007), or use the
            token index (e.g. 7).
          </p>
        </div>

        <div>
          <label
            htmlFor="resolutionDeadline"
            className="mb-1 block text-sm font-medium text-slate-700"
          >
            Resolution deadline
          </label>
          <input
            id="resolutionDeadline"
            type="datetime-local"
            value={resolutionDeadline}
            onChange={(e) => setResolutionDeadline(e.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="tickSize" className="mb-1 block text-sm font-medium text-slate-700">
              Tick size
            </label>
            <input
              id="tickSize"
              type="number"
              min="0"
              step="0.000001"
              value={tickSize}
              onChange={(e) => setTickSize(e.target.value)}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="minOrderSize" className="mb-1 block text-sm font-medium text-slate-700">
              Min order size
            </label>
            <input
              id="minOrderSize"
              type="number"
              min="0"
              step="0.000001"
              value={minOrderSize}
              onChange={(e) => setMinOrderSize(e.target.value)}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="makerFeeBps" className="mb-1 block text-sm font-medium text-slate-700">
              Maker fee (bps)
            </label>
            <input
              id="makerFeeBps"
              type="number"
              min="0"
              value={makerFeeBps}
              onChange={(e) => setMakerFeeBps(e.target.value)}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="takerFeeBps" className="mb-1 block text-sm font-medium text-slate-700">
              Taker fee (bps)
            </label>
            <input
              id="takerFeeBps"
              type="number"
              min="0"
              value={takerFeeBps}
              onChange={(e) => setTakerFeeBps(e.target.value)}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={allowMarketOrders}
            onChange={(e) => setAllowMarketOrders(e.target.checked)}
          />
          Allow market orders
        </label>

        <button
          type="submit"
          disabled={loading}
          className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {loading ? "Creating..." : "Create event contract"}
        </button>
      </form>

      {error && (
        <div className="mt-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-4 rounded border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <div className="flex items-start gap-3">
            <MarketIcon iconUrl={result.icon_url} question={result.question} size="sm" />
            <div>
              <p className="font-medium">{result.question}</p>
              <p className="mt-2 break-all font-mono text-xs">Market: {result.market_address}</p>
              <p className="mt-1 break-all font-mono text-xs">YES token: {result.yes_token}</p>
              <p className="mt-1 break-all font-mono text-xs">NO token: {result.no_token}</p>
              <p className="mt-1 break-all font-mono text-xs">Tx: {result.tx_digest}</p>
              <p className="mt-2 text-xs">
                <a href={`/markets/${result.market_id}`} className="underline">
                  View market
                </a>
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
