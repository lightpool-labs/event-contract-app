import { api } from "@/lib/api";
import MarketDetailClient from "./MarketDetailClient";

export default async function MarketDetailPage({
  params,
}: {
  params: { id: string };
}) {
  let market = null;

  try {
    market = await api.getMarket(params.id);
  } catch {
    market = null;
  }

  return <MarketDetailClient params={params} initialMarket={market} />;
}
