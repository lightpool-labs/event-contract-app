"use client";

import type { BookResponse } from "@/lib/types";
import { MarketIcon } from "@/components/MarketIcon";

type Outcome = "yes" | "no";

function bestAsk(book: BookResponse | null): string | null {
  if (!book || book.asks.length === 0) {
    return null;
  }
  return book.asks[0].price;
}

type MarketOutcomeSelectorProps = {
  question: string;
  iconUrl?: string | null;
  marketAddress: string;
  state: string;
  yesBook: BookResponse | null;
  noBook: BookResponse | null;
  selectedOutcome: Outcome;
  onBuyYes: () => void;
  onBuyNo: () => void;
};

export function MarketOutcomeSelector({
  question,
  iconUrl,
  marketAddress,
  state,
  yesBook,
  noBook,
  selectedOutcome,
  onBuyYes,
  onBuyNo,
}: MarketOutcomeSelectorProps) {
  const yesPrice = bestAsk(yesBook);
  const noPrice = bestAsk(noBook);

  return (
    <section className="rounded-xl border border-sky-100 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-3">
            <MarketIcon iconUrl={iconUrl} question={question} size="lg" />
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-semibold leading-snug text-slate-900 lg:text-2xl">
                {question}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="break-all font-mono text-xs text-slate-500">{marketAddress}</span>
                <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium capitalize text-emerald-700">
                  {state}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid w-full shrink-0 grid-cols-2 gap-2 sm:w-auto sm:min-w-[280px]">
          <button
            type="button"
            onClick={onBuyYes}
            className={[
              "rounded-xl border px-3 py-2.5 text-left transition",
              selectedOutcome === "yes"
                ? "border-emerald-600 bg-emerald-600 text-white shadow-sm"
                : "border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100",
            ].join(" ")}
          >
            <span
              className={[
                "block text-xs font-medium",
                selectedOutcome === "yes" ? "text-emerald-100" : "text-emerald-700",
              ].join(" ")}
            >
              Buy Yes
            </span>
            <span className="block text-lg font-semibold">{yesPrice ? `${yesPrice}¢` : "--"}</span>
          </button>
          <button
            type="button"
            onClick={onBuyNo}
            className={[
              "rounded-xl border px-3 py-2.5 text-left transition",
              selectedOutcome === "no"
                ? "border-rose-600 bg-rose-600 text-white shadow-sm"
                : "border-rose-200 bg-rose-50 text-rose-900 hover:bg-rose-100",
            ].join(" ")}
          >
            <span
              className={[
                "block text-xs font-medium",
                selectedOutcome === "no" ? "text-rose-100" : "text-rose-700",
              ].join(" ")}
            >
              Buy No
            </span>
            <span className="block text-lg font-semibold">{noPrice ? `${noPrice}¢` : "--"}</span>
          </button>
        </div>
      </div>
    </section>
  );
}
