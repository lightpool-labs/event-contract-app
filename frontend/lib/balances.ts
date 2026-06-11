import type { BalanceEntry, BookResponse, Market } from "./types";

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
  marketSlug: string;
  outcome: string;
};

export function findPositionMeta(
  token: string,
  markets: Market[],
): PositionMeta | null {
  for (const market of markets) {
    if (tokensMatch(token, market.yes_token)) {
      return {
        question: market.question,
        marketSlug: market.slug,
        outcome: "yes",
      };
    }
    if (tokensMatch(token, market.no_token)) {
      return {
        question: market.question,
        marketSlug: market.slug,
        outcome: "no",
      };
    }
  }
  return null;
}

export function spotMarketForBalance(
  balance: BalanceEntry,
  markets: Market[],
): string | null {
  const meta = findPositionMeta(balance.token, markets);
  if (!meta) {
    return null;
  }

  const market = markets.find((item) => item.slug === meta.marketSlug);
  if (!market) {
    return null;
  }

  return meta.outcome === "yes" ? market.yes_spot_market : market.no_spot_market;
}

export function spotMarketsForPositions(
  balances: BalanceEntry[],
  markets: Market[] = [],
): string[] {
  const spotMarkets: string[] = [];

  for (const balance of getPositionBalances(balances, markets)) {
    const spotMarket = spotMarketForBalance(balance, markets);
    if (spotMarket) {
      spotMarkets.push(spotMarket);
    }
  }

  return spotMarkets;
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
  markets: Market[],
  booksBySpotMarket: Map<string, BookResponse> = new Map(),
): number {
  const shares = parseAmount(balance.total);
  if (shares <= 0) {
    return 0;
  }

  const spotMarket = spotMarketForBalance(balance, markets);
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
  _markets: Market[] = [],
): BalanceEntry[] {
  return balances.filter(
    (balance) => isPositionBalance(balance) && hasNonZeroPosition(balance),
  );
}

export function sumPortfolio(
  balances: BalanceEntry[],
  markets: Market[] = [],
  booksBySpotMarket: Map<string, BookResponse> = new Map(),
): number {
  return getPositionBalances(balances, markets).reduce(
    (sum, balance) => sum + positionUsdValue(balance, markets, booksBySpotMarket),
    0,
  );
}

export function sumCash(balances: BalanceEntry[], _markets: Market[] = []): number {
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
