"use client";

import Link from "next/link";
import { CreateEventContractForm } from "@/components/CreateEventContractForm";
import { CreateTokenForm } from "@/components/CreateTokenForm";

type Tab = "token" | "market";

const tabs: { id: Tab; label: string }[] = [
  { id: "market", label: "Create Market" },
  { id: "token", label: "Create Token" },
];

function tabHref(tab: Tab) {
  return tab === "market" ? "/admin" : `/admin?tab=${tab}`;
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

      {activeTab === "market" ? (
        <div>
          <p className="mb-4 text-sm text-slate-600">
            Launch a prediction market with YES/NO outcome tokens and spot markets.
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
