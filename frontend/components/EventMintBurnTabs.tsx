"use client";

import Link from "next/link";
import { MintBurnForm } from "@/components/MintBurnForm";
import { MarketIcon } from "@/components/MarketIcon";
import type { Event } from "@/lib/types";

type Tab = "mint" | "burn";

const tabs: { id: Tab; label: string }[] = [
  { id: "mint", label: "Mint" },
  { id: "burn", label: "Burn" },
];

function tabHref(slug: string, tab: Tab) {
  return tab === "mint"
    ? `/events/${slug}/mint-burn`
    : `/events/${slug}/mint-burn?tab=${tab}`;
}

export default function EventMintBurnTabs({
  event,
  activeTab,
}: {
  event: Event;
  activeTab: Tab;
}) {
  return (
    <div>
      <div className="mb-4">
        <div className="flex items-start gap-3">
          <MarketIcon iconUrl={event.icon_url} question={event.question} size="md" />
          <div>
            <h1 className="text-xl font-semibold text-slate-900">{event.question}</h1>
            <p className="mt-1 font-mono text-xs text-slate-500">{event.market_address}</p>
          </div>
        </div>
      </div>

      <div className="mb-6 flex gap-1 border-b border-slate-200">
        {tabs.map((tab) => (
          <Link
            key={tab.id}
            href={tabHref(event.slug, tab.id)}
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
          <MintBurnForm event={event} mode="mint" />
        </div>
      ) : (
        <div>
          <p className="mb-4 text-sm text-slate-600">
            Burn equal YES and NO tokens to recover collateral from this event contract.
          </p>
          <MintBurnForm event={event} mode="burn" />
        </div>
      )}
    </div>
  );
}
