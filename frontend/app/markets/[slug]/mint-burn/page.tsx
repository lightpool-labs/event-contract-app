import { api } from "@/lib/api";
import MarketMintBurnTabs from "@/components/MarketMintBurnTabs";

type Tab = "mint" | "burn";

function parseTab(value?: string): Tab {
  if (value === "burn") {
    return value;
  }
  return "mint";
}

export default async function MarketMintBurnPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { tab?: string };
}) {
  let market = null;

  try {
    market = await api.getMarket(params.slug);
  } catch {
    market = null;
  }

  if (!market) {
    return <p className="text-sm text-slate-500">Market not found.</p>;
  }

  return <MarketMintBurnTabs market={market} activeTab={parseTab(searchParams.tab)} />;
}
