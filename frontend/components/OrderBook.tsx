"use client";

import { useMemo } from "react";
import type { BookLevel, BookResponse, Order } from "@/lib/types";
import { bookLevelKey, ordersAtBookLevel } from "@/lib/orders";

type OrderBookProps = {
  book: BookResponse | null;
  outcome: "yes" | "no";
  openOrders?: Order[];
  loading?: boolean;
  error?: string | null;
  closeAllLoading?: boolean;
  cancellingLevelKey?: string | null;
  onCancelLevel?: (orders: Order[]) => void;
  onCloseAll?: () => void;
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

function formatBookAmount(value: string | number): string {
  const numeric =
    typeof value === "string" ? Number.parseFloat(value) : value;
  if (!Number.isFinite(numeric)) {
    return "--";
  }
  return numeric.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatNotional(price: string, size: string): string {
  const notionalCents = parseLevelPrice(price) * parseLevelSize(size);
  if (!Number.isFinite(notionalCents) || notionalCents === 0) {
    return "--";
  }
  return `$${formatBookAmount(notionalCents / 100)}`;
}

function formatBookPrice(price: string): string {
  const value = Number.parseFloat(price);
  if (!Number.isFinite(value)) {
    return price;
  }
  return String(value);
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
    return `${formatBookPrice(String(ask))}¢`;
  }
  return `${formatBookPrice(String(spread))}¢ spread`;
}

function CloseOrderButton({
  disabled,
  onClick,
}: {
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label="Cancel order"
      title="Cancel order"
      className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-slate-300 text-[10px] leading-none text-slate-500 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-50"
    >
      ×
    </button>
  );
}

type DepthRowProps = {
  level: BookLevel;
  side: "ask" | "bid";
  maxSize: number;
  levelOrders: Order[];
  cancelling: boolean;
  onCancelLevel?: (orders: Order[]) => void;
};

function DepthRow({
  level,
  side,
  maxSize,
  levelOrders,
  cancelling,
  onCancelLevel,
}: DepthRowProps) {
  const sizeValue = parseLevelSize(level.size);
  const depthPercent = Math.min(100, (sizeValue / maxSize) * 100);
  const isAsk = side === "ask";
  const barColor = isAsk ? "bg-rose-200" : "bg-emerald-200";
  const textColor = isAsk ? "text-rose-600" : "text-emerald-600";
  const hasUserOrder = levelOrders.length > 0;

  return (
    <tr className="h-6">
      <td className="relative w-1/2 p-0 pr-2">
        <div className="relative h-6 w-full">
          <div
            className={["absolute inset-y-0 left-0", barColor].join(" ")}
            style={{ width: `${depthPercent}%` }}
          />
          {hasUserOrder && onCancelLevel && (
            <div
              className="absolute inset-y-0 left-0 z-10 flex items-center pl-0.5"
              style={{ width: `${depthPercent}%` }}
            >
              <CloseOrderButton
                disabled={cancelling}
                onClick={() => onCancelLevel(levelOrders)}
              />
            </div>
          )}
        </div>
      </td>
      <td className="h-6 p-0 align-middle pl-1 pr-2">
        <span className={["font-medium tabular-nums", textColor].join(" ")}>
          {formatBookPrice(level.price)}¢
        </span>
      </td>
      <td className="h-6 p-0 align-middle pr-2 text-right">
        <span className="tabular-nums text-slate-700">{formatBookAmount(level.size)}</span>
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
                  {lastTradePrice ? `${formatBookPrice(lastTradePrice)}¢` : "--"}
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

export function OrderBook({
  book,
  outcome,
  openOrders = [],
  loading = false,
  error = null,
  closeAllLoading = false,
  cancellingLevelKey = null,
  onCancelLevel,
  onCloseAll,
}: OrderBookProps) {
  const asks = useMemo(() => [...(book?.asks ?? [])].reverse(), [book?.asks]);
  const bids = book?.bids ?? [];
  const maxSize = useMemo(() => maxLevelSize([...asks, ...bids]), [asks, bids]);
  const hasOpenOrders = openOrders.length > 0;

  const bestBid = bids[0]?.price;
  const bestAsk = book?.asks[0]?.price;
  const spreadLabel = formatSpread(bestBid, bestAsk);
  const lastTradePrice = book?.last_trade_price ?? null;
  const tradeLabel = outcome === "yes" ? "TRADE YES" : "TRADE NO";

  const columnHeaders = (
    <thead>
      <tr className="text-left text-xs text-slate-500">
        <th className="w-1/2 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-700">
          <div className="flex items-center gap-2">
            <span>{tradeLabel}</span>
            {hasOpenOrders && onCloseAll && (
              <button
                type="button"
                onClick={onCloseAll}
                disabled={closeAllLoading || cancellingLevelKey !== null}
                className="rounded border border-slate-300 px-2 py-0.5 text-[10px] font-medium normal-case tracking-normal text-slate-600 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {closeAllLoading ? "Closing..." : "Close all"}
              </button>
            )}
          </div>
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
                {asks.map((level, index) => {
                  const levelOrders = ordersAtBookLevel(openOrders, level.price, "ask");
                  return (
                    <DepthRow
                      key={`ask-${level.price}-${index}`}
                      level={level}
                      side="ask"
                      maxSize={maxSize}
                      levelOrders={levelOrders}
                      cancelling={cancellingLevelKey === bookLevelKey("ask", level.price)}
                      onCancelLevel={onCancelLevel}
                    />
                  );
                })}
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
                {bids.map((level, index) => {
                  const levelOrders = ordersAtBookLevel(openOrders, level.price, "bid");
                  return (
                    <DepthRow
                      key={`bid-${level.price}-${index}`}
                      level={level}
                      side="bid"
                      maxSize={maxSize}
                      levelOrders={levelOrders}
                      cancelling={cancellingLevelKey === bookLevelKey("bid", level.price)}
                      onCancelLevel={onCancelLevel}
                    />
                  );
                })}
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
