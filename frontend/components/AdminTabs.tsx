"use client";

import Link from "next/link";
import { CreateEventContractForm } from "@/components/CreateEventContractForm";
import { CreateTokenForm } from "@/components/CreateTokenForm";
import { EditMarketMetadataForm } from "@/components/EditMarketMetadataForm";

type Tab = "token" | "event" | "metadata";

const tabs: { id: Tab; label: string }[] = [
  { id: "metadata", label: "Update Metadata" },
  { id: "event", label: "Create Event" },
  { id: "token", label: "Create Token" },
];

function tabHref(tab: Tab) {
  if (tab === "metadata") {
    return "/admin";
  }
  return `/admin?tab=${tab}`;
}

export default function AdminTabs({ activeTab }: { activeTab: Tab }) {
  return (
    <div>
      <div className="mb-6 flex gap-1 border-b border-slate-200">
        {tabs.map((tab) => (
          <Link
            key={tab.id}
            href={tabHref(tab.id)}
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

      {activeTab === "metadata" ? (
        <div>
          <p className="mb-4 text-sm text-slate-600">
            Update app-side metadata for markets already created by liquidity-maker / clob-index.
            Does not write to clob-index.
          </p>
          <EditMarketMetadataForm />
        </div>
      ) : activeTab === "event" ? (
        <div>
          <p className="mb-4 text-sm text-slate-600">
            Launch a prediction event with YES/NO outcome tokens and spot markets.
          </p>
          <CreateEventContractForm />
        </div>
      ) : (
        <div>
          <p className="mb-4 text-sm text-slate-600">
            Deploy a collateral token on LightPool via the backend agent signer.
          </p>
          <CreateTokenForm />
        </div>
      )}
    </div>
  );
}
