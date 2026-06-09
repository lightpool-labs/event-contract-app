"use client";

import Link from "next/link";
import { MintBurnForm } from "@/components/MintBurnForm";
import { MarketIcon } from "@/components/MarketIcon";
import type { Market } from "@/lib/types";

type Tab = "mint" | "burn";

const tabs: { id: Tab; label: string }[] = [
  { id: "mint", label: "Mint" },
  { id: "burn", label: "Burn" },
];

function tabHref(marketId: string, tab: Tab) {
  return tab === "mint"
    ? `/markets/${marketId}/mint-burn`
    : `/markets/${marketId}/mint-burn?tab=${tab}`;
}

export default function MarketMintBurnTabs({
  market,
  activeTab,
}: {
  market: Market;
  activeTab: Tab;
}) {
  return (
    <div>
      <div className="mb-4">
        <Link href={`/markets/${market.id}`} className="text-sm text-sky-600 hover:text-sky-800">
          Back to market
        </Link>
        <div className="mt-2 flex items-start gap-3">
          <MarketIcon iconUrl={market.icon_url} question={market.question} size="md" />
          <div>
            <h1 className="text-xl font-semibold text-slate-900">{market.question}</h1>
            <p className="mt-1 font-mono text-xs text-slate-500">{market.market_address}</p>
          </div>
        </div>
      </div>

      <div className="mb-6 flex gap-1 border-b border-slate-200">
        {tabs.map((tab) => (
          <Link
            key={tab.id}
            href={tabHref(market.id, tab.id)}
            className={[
              "px-4 py-2 text-sm font-medium",
              activeTab === tab.id
                ? "border-b-2 border-slate-900 text-slate-900"
                : "text-slate-500 hover:text-slate-700",
            ].join(" ")}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {activeTab === "mint" ? (
        <div>
          <p className="mb-4 text-sm text-slate-600">
            Mint YES and NO tokens by depositing collateral into this event contract.
          </p>
          <MintBurnForm market={market} mode="mint" />
        </div>
      ) : (
        <div>
          <p className="mb-4 text-sm text-slate-600">
            Burn equal YES and NO tokens to recover collateral from this event contract.
          </p>
          <MintBurnForm market={market} mode="burn" />
        </div>
      )}
    </div>
  );
}
