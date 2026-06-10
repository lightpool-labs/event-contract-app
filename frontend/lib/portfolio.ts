import { api } from "@/lib/api";
import {
  getPositionBalances,
  spotMarketsForPositions,
  sumCash,
  sumPortfolio,
} from "@/lib/balances";
import { fetchBooksBySpotMarket } from "@/lib/clob";
import type { BalanceEntry, BookResponse, Event } from "@/lib/types";

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
  events: Event[];
  booksBySpotMarket: Map<string, BookResponse>;
};

export async function loadPortfolioSummary(): Promise<PortfolioSummary> {
  const [balances, events] = await Promise.all([
    api.getBalances(),
    api.listEvents(),
  ]);

  const spotMarkets = spotMarketsForPositions(balances, events);
  const booksBySpotMarket = await fetchBooksBySpotMarket(spotMarkets);

  return {
    portfolio: sumPortfolio(balances, events, booksBySpotMarket),
    cash: sumCash(balances, events),
    balances,
    events,
    booksBySpotMarket,
  };
}

export function summarizeLoadedPortfolio(
  balances: BalanceEntry[],
  events: Event[],
  booksBySpotMarket: Map<string, BookResponse>,
): Pick<PortfolioSummary, "portfolio" | "cash"> {
  return {
    portfolio: sumPortfolio(balances, events, booksBySpotMarket),
    cash: sumCash(balances, events),
  };
}

export function hasOpenPositions(
  balances: BalanceEntry[],
  events: Event[] = [],
): boolean {
  return getPositionBalances(balances, events).length > 0;
}
