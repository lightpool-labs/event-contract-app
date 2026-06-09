"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import type { BookLevel, BookResponse } from "@/lib/types";

type OrderBookProps = {
  marketId: string;
  outcome: "yes" | "no";
  refreshKey?: number;
};

function parseLevelSize(size: string): number {
  const value = Number.parseFloat(size);
  return Number.isFinite(value) ? value : 0;
}

function parseLevelPrice(price: string): number {
  const value = Number.parseFloat(price);
  return Number.isFinite(value) ? value : 0;
}

function maxLevelSize(levels: BookLevel[]): number {
  if (levels.length === 0) {
    return 1;
  }
  return Math.max(...levels.map((level) => parseLevelSize(level.size)), 1);
}

function formatNotional(price: string, size: string): string {
  const notionalCents = parseLevelPrice(price) * parseLevelSize(size);
  if (!Number.isFinite(notionalCents) || notionalCents === 0) {
    return "--";
  }
  return `$${(notionalCents / 100).toFixed(2)}`;
}

function formatSpread(bestBid: string | undefined, bestAsk: string | undefined): string | null {
  if (!bestBid || !bestAsk) {
    return null;
  }
  const bid = Number.parseFloat(bestBid);
  const ask = Number.parseFloat(bestAsk);
  if (!Number.isFinite(bid) || !Number.isFinite(ask)) {
    return null;
  }
  const spread = ask - bid;
  if (spread <= 0) {
    return `${ask.toFixed(0)}¢`;
  }
  return `${spread.toFixed(0)}¢ spread`;
}

type DepthRowProps = {
  level: BookLevel;
  side: "ask" | "bid";
  maxSize: number;
};

function DepthRow({ level, side, maxSize }: DepthRowProps) {
  const sizeValue = parseLevelSize(level.size);
  const depthPercent = Math.min(100, (sizeValue / maxSize) * 100);
  const isAsk = side === "ask";
  const barColor = isAsk ? "bg-rose-200" : "bg-emerald-200";
  const textColor = isAsk ? "text-rose-600" : "text-emerald-600";

  return (
    <tr className="h-6">
      <td className="relative w-1/2 p-0 pr-2">
        <div className="relative h-6 w-full">
          <div
            className={["absolute inset-y-0 left-0", barColor].join(" ")}
            style={{ width: `${depthPercent}%` }}
          />
        </div>
      </td>
      <td className="h-6 p-0 align-middle pl-1 pr-2">
        <span className={["font-medium tabular-nums", textColor].join(" ")}>
          {level.price}¢
        </span>
      </td>
      <td className="h-6 p-0 align-middle pr-2 text-right">
        <span className="tabular-nums text-slate-700">{level.size}</span>
      </td>
      <td className="h-6 p-0 align-middle text-right">
        <span className="tabular-nums text-slate-600">{formatNotional(level.price, level.size)}</span>
      </td>
    </tr>
  );
}

function SpreadSection({
  lastTradePrice,
  spreadLabel,
}: {
  lastTradePrice: string | null;
  spreadLabel: string | null;
}) {
  return (
    <div className="my-2 border-y border-slate-100 py-2">
      <table className="w-full table-fixed">
        <tbody>
          <tr>
            <td colSpan={4} className="py-0.5">
              <div className="relative flex items-center">
                <span className="text-xs font-semibold tabular-nums text-slate-900">
                  {lastTradePrice ? `${lastTradePrice}¢` : "--"}
                </span>
                {spreadLabel && (
                  <span className="absolute left-1/2 -translate-x-1/2 text-xs font-medium tabular-nums text-slate-500">
                    {spreadLabel}
                  </span>
                )}
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export function OrderBook({ marketId, outcome, refreshKey = 0 }: OrderBookProps) {
  const [book, setBook] = useState<BookResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadBook = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.getBook(marketId, outcome);
      setBook(response);
    } catch (err) {
      setBook(null);
      setError(err instanceof Error ? err.message : "Failed to load order book");
    } finally {
      setLoading(false);
    }
  }, [marketId, outcome]);

  useEffect(() => {
    loadBook();
  }, [loadBook, refreshKey]);

  const asks = useMemo(() => [...(book?.asks ?? [])].reverse(), [book?.asks]);
  const bids = book?.bids ?? [];
  const maxSize = useMemo(() => maxLevelSize([...asks, ...bids]), [asks, bids]);

  const bestBid = bids[0]?.price;
  const bestAsk = book?.asks[0]?.price;
  const spreadLabel = formatSpread(bestBid, bestAsk);
  const lastTradePrice = book?.last_trade_price ?? null;
  const tradeLabel = outcome === "yes" ? "TRADE YES" : "TRADE NO";

  const columnHeaders = (
    <thead>
      <tr className="text-left text-xs text-slate-500">
        <th className="w-1/2 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-700">
          {tradeLabel}
        </th>
        <th className="w-[17%] pb-2 font-medium">Price</th>
        <th className="w-[16%] pb-2 text-right font-medium">Size</th>
        <th className="w-[17%] pb-2 text-right font-medium">Total</th>
      </tr>
    </thead>
  );

  return (
    <section className="rounded-xl border border-sky-100 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-3">
        <h2 className="text-sm font-semibold text-slate-900">Order Book</h2>
      </div>

      <div className="px-5 py-4">
        {loading && <p className="text-sm text-slate-500">Loading book...</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}

        {!loading && !error && (
          <div className="text-sm">
            <table className="w-full table-fixed border-collapse">
              {columnHeaders}
              <tbody>
                {asks.map((level, index) => (
                  <DepthRow
                    key={`ask-${level.price}-${index}`}
                    level={level}
                    side="ask"
                    maxSize={maxSize}
                  />
                ))}
                {asks.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-2 text-slate-400">
                      No asks
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            <SpreadSection lastTradePrice={lastTradePrice} spreadLabel={spreadLabel} />

            <table className="w-full table-fixed border-collapse">
              <tbody>
                {bids.map((level, index) => (
                  <DepthRow
                    key={`bid-${level.price}-${index}`}
                    level={level}
                    side="bid"
                    maxSize={maxSize}
                  />
                ))}
                {bids.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-2 text-slate-400">
                      No bids
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
