"use client";

import { useEffect, useState } from "react";
import { MarketOutcomeSelector } from "@/components/MarketOutcomeSelector";
import { OrderBook } from "@/components/OrderBook";
import { PlaceOrderPanel } from "@/components/PlaceOrderPanel";
import { createOrderBookSubscription } from "@/lib/clob";
import { api } from "@/lib/api";
import {
  bookLevelKey,
  bookSideForOrderSide,
  filterOrdersForBook,
} from "@/lib/orders";
import { requestPortfolioRefresh } from "@/lib/portfolio";
import type { BookResponse, Event, Order } from "@/lib/types";

export default function EventDetailClient({
  params,
  initialEvent,
  initialOutcome,
}: {
  params: { slug: string };
  initialEvent: Event | null;
  initialOutcome: "yes" | "no";
}) {
  const [outcome, setOutcome] = useState<"yes" | "no">(initialOutcome);
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [orderType, setOrderType] = useState<"limit" | "market">("limit");
  const [price, setPrice] = useState("50");
  const [size, setSize] = useState("10");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [yesBook, setYesBook] = useState<BookResponse | null>(null);
  const [noBook, setNoBook] = useState<BookResponse | null>(null);
  const [bookLoading, setBookLoading] = useState(true);
  const [bookError, setBookError] = useState<string | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [closeAllLoading, setCloseAllLoading] = useState(false);
  const [cancellingLevelKey, setCancellingLevelKey] = useState<string | null>(null);

  useEffect(() => {
    setOutcome(initialOutcome);
  }, [initialOutcome]);

  async function refreshOrders() {
    try {
      const nextOrders = await api.listOrders();
      setOrders(nextOrders);
    } catch {
      // Keep the previous order list when refresh fails.
    }
  }

  useEffect(() => {
    void refreshOrders();
  }, []);

  useEffect(() => {
    if (!initialEvent) {
      return;
    }

    setBookLoading(true);
    setBookError(null);

    let yesLoaded = false;
    let noLoaded = false;

    const markLoaded = () => {
      if (yesLoaded && noLoaded) {
        setBookLoading(false);
      }
    };

    const unsubscribeYes = createOrderBookSubscription(initialEvent.yes_spot_market, 10, {
      onBook: (book) => {
        setYesBook(book);
        yesLoaded = true;
        markLoaded();
      },
      onError: (error) => {
        setBookError(error.message);
        setBookLoading(false);
      },
    });
    const unsubscribeNo = createOrderBookSubscription(initialEvent.no_spot_market, 10, {
      onBook: (book) => {
        setNoBook(book);
        noLoaded = true;
        markLoaded();
      },
      onError: (error) => {
        setBookError(error.message);
        setBookLoading(false);
      },
    });

    return () => {
      unsubscribeYes();
      unsubscribeNo();
    };
  }, [initialEvent]);

  if (!initialEvent) {
    return <p className="text-sm text-slate-500">Event not found.</p>;
  }

  const activeBook = outcome === "yes" ? yesBook : noBook;
  const openOrders = filterOrdersForBook(orders, params.slug, outcome);

  async function cancelOrders(levelOrders: Order[]) {
    if (levelOrders.length === 0) {
      return;
    }

    const firstOrder = levelOrders[0];
    const levelKey = bookLevelKey(
      bookSideForOrderSide(firstOrder.side),
      firstOrder.price,
    );
    setCancellingLevelKey(levelKey);
    setMessage(null);

    try {
      for (const order of levelOrders) {
        await api.cancelOrder(order.id);
      }
      await refreshOrders();
      requestPortfolioRefresh();
      setMessage(
        levelOrders.length === 1
          ? "Order cancelled."
          : `${levelOrders.length} orders cancelled.`,
      );
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Cancel failed");
    } finally {
      setCancellingLevelKey(null);
    }
  }

  async function closeAllOrders() {
    if (openOrders.length === 0) {
      return;
    }

    setCloseAllLoading(true);
    setMessage(null);

    try {
      for (const order of openOrders) {
        await api.cancelOrder(order.id);
      }
      await refreshOrders();
      requestPortfolioRefresh();
      setMessage(
        openOrders.length === 1
          ? "Order cancelled."
          : `${openOrders.length} orders cancelled.`,
      );
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Close all failed");
    } finally {
      setCloseAllLoading(false);
    }
  }

  function selectBuyYes() {
    setOutcome("yes");
    setSide("buy");
    const ask = yesBook?.asks[0]?.price;
    if (ask) {
      setPrice(ask);
    }
  }

  function selectBuyNo() {
    setOutcome("no");
    setSide("buy");
    const ask = noBook?.asks[0]?.price;
    if (ask) {
      setPrice(ask);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const order = await api.placeOrder({
        event_slug: params.slug,
        outcome,
        side,
        price,
        size,
        order_type: orderType,
      });
      setMessage(`Order placed: ${order.id} (${order.status}).`);
      await refreshOrders();
      requestPortfolioRefresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Order failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-4">
        <MarketOutcomeSelector
          question={initialEvent.question}
          iconUrl={initialEvent.icon_url}
          marketAddress={initialEvent.market_address}
          state={initialEvent.state}
          yesBook={yesBook}
          noBook={noBook}
          selectedOutcome={outcome}
          onBuyYes={selectBuyYes}
          onBuyNo={selectBuyNo}
        />

        <OrderBook
          book={activeBook}
          outcome={outcome}
          openOrders={openOrders}
          loading={bookLoading}
          error={bookError}
          closeAllLoading={closeAllLoading}
          cancellingLevelKey={cancellingLevelKey}
          onCancelLevel={(levelOrders) => {
            void cancelOrders(levelOrders);
          }}
          onCloseAll={() => {
            void closeAllOrders();
          }}
        />
      </div>

      <PlaceOrderPanel
        outcome={outcome}
        side={side}
        orderType={orderType}
        price={price}
        size={size}
        loading={loading}
        message={message}
        onSideChange={setSide}
        onOrderTypeChange={setOrderType}
        onPriceChange={setPrice}
        onSizeChange={setSize}
        onSubmit={onSubmit}
      />
    </div>
  );
}
