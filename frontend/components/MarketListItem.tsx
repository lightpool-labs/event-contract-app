"use client";

import Link from "next/link";
import { MarketIcon } from "@/components/MarketIcon";
import type { Market } from "@/lib/types";

export function MarketListItem({ market }: { market: Market }) {
  return (
    <article className="rounded-xl border border-sky-100 bg-white p-5 shadow-sm transition hover:border-sky-300 hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <Link href={`/markets/${market.slug}`} className="min-w-0 flex-1">
          <div className="flex items-start gap-3">
            <MarketIcon iconUrl={market.icon_url} question={market.question} size="md" />
            <div className="min-w-0">
              <h2 className="text-lg font-medium text-slate-900">{market.question}</h2>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="break-all font-mono text-xs text-slate-500">
                  {market.market_address}
                </span>
                <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium capitalize text-emerald-700">
                  {market.state}
                </span>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Deadline: {new Date(market.resolution_deadline * 1000).toLocaleString()}
              </p>
            </div>
          </div>
        </Link>

        <div className="grid min-w-[280px] shrink-0 grid-cols-2 gap-2 self-end">
          <Link
            href={`/markets/${market.slug}/mint-burn?tab=mint`}
            className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-center transition hover:bg-emerald-100"
          >
            <span className="block text-xs font-medium text-emerald-700">Mint</span>
          </Link>
          <Link
            href={`/markets/${market.slug}/mint-burn?tab=burn`}
            className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-center transition hover:bg-rose-100"
          >
            <span className="block text-xs font-medium text-rose-700">Burn</span>
          </Link>
        </div>
      </div>
    </article>
  );
}
