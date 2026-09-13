import type { Market } from "@/lib/types";

export type MarketListEntry =
  | { kind: "group"; eventSlug: string; markets: Market[] }
  | { kind: "single"; market: Market };

function yesRateValue(market: Market): number {
  const value = Number.parseFloat(market.yes_rate ?? "");
  return Number.isFinite(value) ? value : Number.POSITIVE_INFINITY;
}

export function groupMarketsForList(markets: Market[]): MarketListEntry[] {
  const groups = new Map<string, Market[]>();
  const singles: Market[] = [];

  for (const market of markets) {
    const eventSlug = market.event_slug?.trim();
    if (!eventSlug) {
      singles.push(market);
      continue;
    }
    const list = groups.get(eventSlug) ?? [];
    list.push(market);
    groups.set(eventSlug, list);
  }

  const entries: MarketListEntry[] = [];

  for (const [eventSlug, groupMarkets] of groups) {
    const sorted = [...groupMarkets].sort((left, right) => {
      const rateDiff = yesRateValue(left) - yesRateValue(right);
      if (rateDiff !== 0) {
        return rateDiff;
      }
      return left.slug.localeCompare(right.slug);
    });
    entries.push({ kind: "group", eventSlug, markets: sorted });
  }

  entries.sort((left, right) => {
    const leftKey = left.kind === "group" ? left.eventSlug : left.market.slug;
    const rightKey = right.kind === "group" ? right.eventSlug : right.market.slug;
    return leftKey.localeCompare(rightKey);
  });

  for (const market of singles) {
    entries.push({ kind: "single", market });
  }

  return entries;
}
