import { api } from "@/lib/api";
import { VaultListItem } from "@/components/VaultListItem";
import type { Vault } from "@/lib/types";

export default async function VaultsPage() {
  let vaults: Vault[] = [];
  let error: string | null = null;

  try {
    vaults = await api.listVaults();
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load vaults";
  }

  return (
    <div>
      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-4">
        {vaults.map((vault) => (
          <VaultListItem key={vault.id} vault={vault} />
        ))}

        {!error && vaults.length === 0 && (
          <p className="text-sm text-slate-500">No vaults yet.</p>
        )}
      </div>
    </div>
  );
}
