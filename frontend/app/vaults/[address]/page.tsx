import { api } from "@/lib/api";
import { formatAddress } from "@/lib/address";
import type { Vault } from "@/lib/types";
import Link from "next/link";

type VaultDetailPageProps = {
  params: Promise<{ address: string }>;
};

export default async function VaultDetailPage({ params }: VaultDetailPageProps) {
  const { address } = await params;
  const decoded = decodeURIComponent(address);

  let vault: Vault | null = null;
  let error: string | null = null;

  try {
    vault = await api.getVault(decoded);
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load vault";
  }

  if (error || !vault) {
    return (
      <div>
        <Link href="/vaults" className="text-sm text-sky-700 hover:underline">
          ← Back to vaults
        </Link>
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error ?? "Vault not found"}
        </div>
      </div>
    );
  }

  const status = vault.is_closed
    ? "Closed"
    : vault.allow_deposit
      ? "Open for deposits"
      : "Deposits closed";

  return (
    <div>
      <Link href="/vaults" className="text-sm text-sky-700 hover:underline">
        ← Back to vaults
      </Link>

      <div className="mt-4 rounded-2xl border border-sky-100 bg-white px-6 py-5 shadow-sm">
        <h1 className="font-mono text-xl font-semibold text-sky-800">
          {vault.vault_address}
        </h1>
        <p className="mt-2 text-sm text-slate-500">{status}</p>

        <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">Vault account</dt>
            <dd className="mt-1 font-mono text-slate-800">{vault.vault_account}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Manager</dt>
            <dd className="mt-1 font-mono text-slate-800">
              {formatAddress(vault.manager)}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Quote token</dt>
            <dd className="mt-1 font-mono text-slate-800">{vault.quote_token}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Share token</dt>
            <dd className="mt-1 font-mono text-slate-800">{vault.share_token}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Equity</dt>
            <dd className="mt-1 font-mono text-slate-800">
              {vault.equity || "—"}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Allow deposit</dt>
            <dd className="mt-1 text-slate-800">
              {vault.allow_deposit ? "yes" : "no"}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
