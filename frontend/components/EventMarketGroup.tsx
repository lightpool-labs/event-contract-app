"use client";

import Link from "next/link";
import { MarketIcon } from "@/components/MarketIcon";
import type { Market } from "@/lib/types";

function formatYesRate(yesRate?: string | null): string {
  if (!yesRate) {
    return "—";
  }
  const value = Number.parseFloat(yesRate);
  if (!Number.isFinite(value)) {
    return "—";
  }
  return `${value % 1 === 0 ? value.toFixed(0) : value.toFixed(1)}%`;
}

export function EventMarketGroup({
  eventSlug,
  markets,
}: {
  eventSlug: string;
  markets: Market[];
}) {
  const lead = markets[0];

  return (
    <article className="overflow-hidden rounded-xl border border-sky-100 bg-white shadow-sm">
      <div className="flex items-start gap-3 border-b border-slate-100 px-5 py-4">
        <MarketIcon
          iconUrl={lead?.icon_url}
          question={lead?.question || eventSlug}
          size="md"
        />
        <div className="min-w-0">
          <h2 className="break-all text-lg font-medium text-slate-900">{eventSlug}</h2>
          <p className="mt-1 text-xs text-slate-500">
            {markets.length} market{markets.length === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      <ul className="divide-y divide-slate-100">
        {markets.map((market) => (
          <li key={market.id}>
            <div className="flex items-center gap-3 px-5 py-3">
              <Link href={`/markets/${market.slug}`} className="min-w-0 flex-1">
                <span className="text-sm font-medium text-slate-900">
                  {market.group_item_title?.trim() || "Untitled"}
                </span>
                <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium capitalize text-emerald-700">
                  {market.state}
                </span>
              </Link>

              <div className="shrink-0 text-right">
                <span className="text-2xl font-semibold tabular-nums text-slate-900">
                  {formatYesRate(market.yes_rate)}
                </span>
              </div>

              <div className="grid shrink-0 grid-cols-2 gap-1.5">
                <Link
                  href={`/markets/${market.slug}/mint-burn?tab=mint`}
                  className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-center text-[11px] font-medium text-emerald-700 hover:bg-emerald-100"
                >
                  Mint
                </Link>
                <Link
                  href={`/markets/${market.slug}/mint-burn?tab=burn`}
                  className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-center text-[11px] font-medium text-rose-700 hover:bg-rose-100"
                >
                  Burn
                </Link>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </article>
  );
}
