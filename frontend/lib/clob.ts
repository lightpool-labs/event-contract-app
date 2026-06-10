import type { BookLevel, BookResponse } from "@/lib/types";

const CLOB_INDEX_URL =
  process.env.NEXT_PUBLIC_CLOB_INDEX_URL ?? "http://127.0.0.1:3002";
const CLOB_INDEX_WS_URL =
  process.env.NEXT_PUBLIC_CLOB_INDEX_WS_URL ?? "ws://127.0.0.1:3002";

export type OrderBookDelta = {
  type: "orderbook_delta";
  spot_market: string;
  sequence: number;
  block_num: number;
  bids: BookLevel[];
  asks: BookLevel[];
  last_trade_price?: string | null;
};

type OrderBookSnapshot = BookResponse & {
  type: "orderbook_snapshot";
  spot_market: string;
};

function spotMarketPath(spotMarket: string): string {
  return encodeURIComponent(spotMarket);
}

function comparePriceDesc(a: string, b: string): number {
  return Number.parseFloat(b) - Number.parseFloat(a);
}

function comparePriceAsc(a: string, b: string): number {
  return Number.parseFloat(a) - Number.parseFloat(b);
}

function applyLevelChanges(
  levels: BookLevel[],
  changes: BookLevel[],
  sort: (a: string, b: string) => number,
): BookLevel[] {
  const map = new Map(levels.map((level) => [level.price, level.size]));
  for (const change of changes) {
    if (change.size === "0") {
      map.delete(change.price);
    } else {
      map.set(change.price, change.size);
    }
  }
  return Array.from(map.entries())
    .map(([price, size]) => ({ price, size }))
    .sort((a, b) => sort(a.price, b.price));
}

export function applyOrderBookDelta(
  book: BookResponse,
  delta: OrderBookDelta,
): BookResponse {
  return {
    sequence: delta.sequence,
    bids: applyLevelChanges(book.bids, delta.bids, comparePriceDesc),
    asks: applyLevelChanges(book.asks, delta.asks, comparePriceAsc),
    last_trade_price: delta.last_trade_price ?? book.last_trade_price,
  };
}

export async function fetchBooksBySpotMarket(
  spotMarkets: string[],
  depth = 1,
): Promise<Map<string, BookResponse>> {
  const uniqueMarkets = [...new Set(spotMarkets.filter((market) => market.trim().length > 0))];
  const books = new Map<string, BookResponse>();

  await Promise.all(
    uniqueMarkets.map(async (spotMarket) => {
      try {
        const book = await fetchBookSnapshot(spotMarket, depth);
        books.set(spotMarket, book);
      } catch {
        // Skip unavailable books; portfolio valuation falls back for that market.
      }
    }),
  );

  return books;
}

export async function fetchBookSnapshot(
  spotMarket: string,
  depth = 10,
): Promise<BookResponse> {
  const res = await fetch(
    `${CLOB_INDEX_URL}/api/spot/${spotMarketPath(spotMarket)}/book?depth=${depth}`,
    { cache: "no-store" },
  );

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Failed to load order book: ${res.status}`);
  }

  return res.json() as Promise<BookResponse>;
}

export function createOrderBookSubscription(
  spotMarket: string,
  depth: number,
  handlers: {
    onBook: (book: BookResponse) => void;
    onError?: (error: Error) => void;
  },
): () => void {
  let closed = false;
  let currentBook: BookResponse | null = null;
  let socket: WebSocket | null = null;
  let pending = false;
  let rafId: number | null = null;

  function scheduleRender() {
    if (pending || closed || !currentBook) {
      return;
    }
    pending = true;
    rafId = window.requestAnimationFrame(() => {
      pending = false;
      if (!closed && currentBook) {
        handlers.onBook(currentBook);
      }
    });
  }

  async function start() {
    try {
      currentBook = await fetchBookSnapshot(spotMarket, depth);
      scheduleRender();
    } catch (error) {
      handlers.onError?.(
        error instanceof Error ? error : new Error("Failed to load order book"),
      );
    }

    if (closed) {
      return;
    }

    socket = new WebSocket(`${CLOB_INDEX_WS_URL}/api/ws`);
    socket.onopen = () => {
      socket?.send(
        JSON.stringify({
          op: "subscribe",
          channel: "orderbook",
          spot_market: spotMarket,
          depth,
        }),
      );
    };
    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data as string) as
          | OrderBookSnapshot
          | OrderBookDelta
          | { type: "error"; error: string };

        if (payload.type === "error") {
          handlers.onError?.(new Error(payload.error));
          return;
        }

        if (payload.type === "orderbook_snapshot") {
          currentBook = {
            sequence: payload.sequence,
            bids: payload.bids,
            asks: payload.asks,
            last_trade_price: payload.last_trade_price,
          };
          scheduleRender();
          return;
        }

        if (payload.type === "orderbook_delta" && currentBook) {
          currentBook = applyOrderBookDelta(currentBook, payload);
          scheduleRender();
        }
      } catch (error) {
        handlers.onError?.(
          error instanceof Error ? error : new Error("Invalid order book message"),
        );
      }
    };
    socket.onerror = () => {
      handlers.onError?.(new Error("Order book websocket error"));
    };
  }

  void start();

  return () => {
    closed = true;
    if (rafId !== null) {
      window.cancelAnimationFrame(rafId);
    }
    if (socket && socket.readyState <= WebSocket.OPEN) {
      try {
        socket.send(
          JSON.stringify({
            op: "unsubscribe",
            channel: "orderbook",
            spot_market: spotMarket,
          }),
        );
      } catch {
        // ignore cleanup errors
      }
      socket.close();
    }
    socket = null;
  };
}
