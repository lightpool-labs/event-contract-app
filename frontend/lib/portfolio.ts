import { api } from "@/lib/api";
import {
  getPositionBalances,
  spotMarketsForPositions,
  sumCash,
  sumPortfolio,
} from "@/lib/balances";
import { fetchBooksBySpotMarket } from "@/lib/clob";
import type { BalanceEntry, BookResponse, Market } from "@/lib/types";

export const PORTFOLIO_REFRESH_EVENT = "lightpool:portfolio-refresh";

export function requestPortfolioRefresh(): void {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(new Event(PORTFOLIO_REFRESH_EVENT));
}

export type PortfolioSummary = {
  portfolio: number;
  cash: number;
  balances: BalanceEntry[];
  markets: Market[];
  booksBySpotMarket: Map<string, BookResponse>;
};

export async function loadPortfolioSummary(): Promise<PortfolioSummary> {
  const [balances, markets] = await Promise.all([
    api.getBalances(),
    api.listMarkets(),
  ]);

  const spotMarkets = spotMarketsForPositions(balances, markets);
  const booksBySpotMarket = await fetchBooksBySpotMarket(spotMarkets);

  return {
    portfolio: sumPortfolio(balances, markets, booksBySpotMarket),
    cash: sumCash(balances, markets),
    balances,
    markets,
    booksBySpotMarket,
  };
}

export function summarizeLoadedPortfolio(
  balances: BalanceEntry[],
  markets: Market[],
  booksBySpotMarket: Map<string, BookResponse>,
): Pick<PortfolioSummary, "portfolio" | "cash"> {
  return {
    portfolio: sumPortfolio(balances, markets, booksBySpotMarket),
    cash: sumCash(balances, markets),
  };
}

export function hasOpenPositions(
  balances: BalanceEntry[],
  markets: Market[] = [],
): boolean {
  return getPositionBalances(balances, markets).length > 0;
}
