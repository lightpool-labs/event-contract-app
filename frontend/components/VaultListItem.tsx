"use client";

import Link from "next/link";
import { formatAddress } from "@/lib/address";
import type { Vault } from "@/lib/types";

type VaultListItemProps = {
  vault: Vault;
};

export function VaultListItem({ vault }: VaultListItemProps) {
  const status = vault.is_closed
    ? "Closed"
    : vault.allow_deposit
      ? "Open"
      : "Deposits closed";

  return (
    <Link
      href={`/vaults/${encodeURIComponent(vault.vault_address)}`}
      className="block rounded-2xl border border-sky-100 bg-white px-5 py-4 shadow-sm transition hover:border-sky-200 hover:shadow"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-sm font-semibold text-sky-800">
            {formatAddress(vault.vault_address)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Manager {formatAddress(vault.manager)}
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
          {status}
        </span>
      </div>
      <div className="mt-3 grid gap-1 text-xs text-slate-600 sm:grid-cols-2">
        <p>
          Account{" "}
          <span className="font-mono text-slate-800">
            {formatAddress(vault.vault_account)}
          </span>
        </p>
        <p>
          Equity{" "}
          <span className="font-mono text-slate-800">{vault.equity || "—"}</span>
        </p>
        <p>
          Quote{" "}
          <span className="font-mono text-slate-800">
            {formatAddress(vault.quote_token)}
          </span>
        </p>
        <p>
          Share{" "}
          <span className="font-mono text-slate-800">
            {formatAddress(vault.share_token)}
          </span>
        </p>
      </div>
    </Link>
  );
}
