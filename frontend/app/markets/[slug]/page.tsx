import { api } from "@/lib/api";
import MarketDetailClient from "./MarketDetailClient";

function parseOutcome(value?: string): "yes" | "no" {
  if (value === "no") {
    return "no";
  }
  return "yes";
}

export default async function MarketDetailPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { outcome?: string };
}) {
  let market = null;

  try {
    market = await api.getMarket(params.slug);
  } catch {
    market = null;
  }

  return (
    <MarketDetailClient
      params={params}
      initialMarket={market}
      initialOutcome={parseOutcome(searchParams.outcome)}
    />
  );
}
