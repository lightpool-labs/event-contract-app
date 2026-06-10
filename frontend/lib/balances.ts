import type { BalanceEntry, BookResponse, Event } from "./types";

function parseAmount(value: string): number {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

function normalizeToken(token: string): string {
  return token.trim().toLowerCase();
}

function canonicalTokenKey(token: string): string {
  const normalized = normalizeToken(token).replace(/^0x/, "");
  if (normalized.length >= 16) {
    return normalized.slice(-16);
  }
  return normalized;
}

function tokensMatch(left: string, right: string): boolean {
  const leftKey = canonicalTokenKey(left);
  const rightKey = canonicalTokenKey(right);
  return leftKey === rightKey || normalizeToken(left) === normalizeToken(right);
}

function isPositionSymbol(symbol: string): boolean {
  return symbol === "YES" || symbol === "NO";
}

function isPositionBalance(balance: BalanceEntry): boolean {
  return isPositionSymbol(balance.symbol);
}

function hasNonZeroPosition(balance: BalanceEntry): boolean {
  return parseAmount(balance.total) > 0 || parseAmount(balance.locked) > 0;
}

export type PositionMeta = {
  question: string;
  eventSlug: string;
  outcome: string;
};

export function findPositionMeta(
  token: string,
  events: Event[],
): PositionMeta | null {
  for (const event of events) {
    if (tokensMatch(token, event.yes_token)) {
      return {
        question: event.question,
        eventSlug: event.slug,
        outcome: "yes",
      };
    }
    if (tokensMatch(token, event.no_token)) {
      return {
        question: event.question,
        eventSlug: event.slug,
        outcome: "no",
      };
    }
  }
  return null;
}

export function spotMarketForBalance(
  balance: BalanceEntry,
  events: Event[],
): string | null {
  const meta = findPositionMeta(balance.token, events);
  if (!meta) {
    return null;
  }

  const event = events.find((item) => item.slug === meta.eventSlug);
  if (!event) {
    return null;
  }

  return meta.outcome === "yes" ? event.yes_spot_market : event.no_spot_market;
}

export function spotMarketsForPositions(
  balances: BalanceEntry[],
  events: Event[] = [],
): string[] {
  const markets: string[] = [];

  for (const balance of getPositionBalances(balances, events)) {
    const spotMarket = spotMarketForBalance(balance, events);
    if (spotMarket) {
      markets.push(spotMarket);
    }
  }

  return markets;
}

export function getMarkPriceCents(book: BookResponse | undefined): number | null {
  if (!book) {
    return null;
  }

  if (book.last_trade_price) {
    const lastTrade = Number.parseFloat(book.last_trade_price);
    if (Number.isFinite(lastTrade) && lastTrade > 0) {
      return lastTrade;
    }
  }

  const bestBid = book.bids[0]?.price;
  const bestAsk = book.asks[0]?.price;

  if (bestBid && bestAsk) {
    const bid = Number.parseFloat(bestBid);
    const ask = Number.parseFloat(bestAsk);
    if (Number.isFinite(bid) && Number.isFinite(ask) && bid > 0 && ask > 0) {
      return (bid + ask) / 2;
    }
  }

  if (bestBid) {
    const bid = Number.parseFloat(bestBid);
    if (Number.isFinite(bid) && bid > 0) {
      return bid;
    }
  }

  if (bestAsk) {
    const ask = Number.parseFloat(bestAsk);
    if (Number.isFinite(ask) && ask > 0) {
      return ask;
    }
  }

  return null;
}

function resolveBookForSpotMarket(
  spotMarket: string,
  booksBySpotMarket: Map<string, BookResponse>,
): BookResponse | undefined {
  if (booksBySpotMarket.has(spotMarket)) {
    return booksBySpotMarket.get(spotMarket);
  }

  const lowered = spotMarket.toLowerCase();
  for (const [key, book] of booksBySpotMarket.entries()) {
    if (key.toLowerCase() === lowered) {
      return book;
    }
  }

  return undefined;
}

export function positionUsdValue(
  balance: BalanceEntry,
  events: Event[],
  booksBySpotMarket: Map<string, BookResponse> = new Map(),
): number {
  const shares = parseAmount(balance.total);
  if (shares <= 0) {
    return 0;
  }

  const spotMarket = spotMarketForBalance(balance, events);
  if (!spotMarket) {
    return shares * 0.5;
  }

  const book = resolveBookForSpotMarket(spotMarket, booksBySpotMarket);
  const markCents = getMarkPriceCents(book);
  if (markCents === null) {
    return shares * 0.5;
  }

  return (shares * markCents) / 100;
}

export function getPositionBalances(
  balances: BalanceEntry[],
  _events: Event[] = [],
): BalanceEntry[] {
  return balances.filter(
    (balance) => isPositionBalance(balance) && hasNonZeroPosition(balance),
  );
}

export function sumPortfolio(
  balances: BalanceEntry[],
  events: Event[] = [],
  booksBySpotMarket: Map<string, BookResponse> = new Map(),
): number {
  return getPositionBalances(balances, events).reduce(
    (sum, balance) => sum + positionUsdValue(balance, events, booksBySpotMarket),
    0,
  );
}

export function sumCash(balances: BalanceEntry[], _events: Event[] = []): number {
  return balances
    .filter((balance) => !isPositionSymbol(balance.symbol))
    .reduce((sum, balance) => sum + parseAmount(balance.total), 0);
}

export function formatUsd(value: number): string {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function portfolioLabel(value: number): string {
  return `$${formatUsd(value)}`;
}

export function cashLabel(value: number): string {
  return `$${formatUsd(value)}`;
}
