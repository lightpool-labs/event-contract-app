"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MarketOutcomeSelector } from "@/components/MarketOutcomeSelector";
import { OrderBook } from "@/components/OrderBook";
import { PlaceOrderPanel } from "@/components/PlaceOrderPanel";
import { api } from "@/lib/api";
import type { BookResponse, Market } from "@/lib/types";

export default function MarketDetailPage({
  params,
  initialMarket,
}: {
  params: { id: string };
  initialMarket: Market | null;
}) {
  const router = useRouter();
  const [outcome, setOutcome] = useState<"yes" | "no">("yes");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [orderType, setOrderType] = useState<"limit" | "market">("limit");
  const [price, setPrice] = useState("50");
  const [size, setSize] = useState("10");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [bookRefreshKey, setBookRefreshKey] = useState(0);
  const [yesBook, setYesBook] = useState<BookResponse | null>(null);
  const [noBook, setNoBook] = useState<BookResponse | null>(null);

  const loadOutcomeBooks = useCallback(async () => {
    try {
      const [yes, no] = await Promise.all([
        api.getBook(params.id, "yes"),
        api.getBook(params.id, "no"),
      ]);
      setYesBook(yes);
      setNoBook(no);
    } catch {
      setYesBook(null);
      setNoBook(null);
    }
  }, [params.id]);

  useEffect(() => {
    loadOutcomeBooks();
  }, [loadOutcomeBooks, bookRefreshKey]);

  if (!initialMarket) {
    return <p className="text-sm text-slate-500">Market not found.</p>;
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
        market_id: params.id,
        outcome,
        side,
        price,
        size,
        order_type: orderType,
      });
      setMessage(`Order placed: ${order.id} (${order.status}).`);
      setBookRefreshKey((value) => value + 1);
      router.refresh();
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
          question={initialMarket.question}
          iconUrl={initialMarket.icon_url}
          marketAddress={initialMarket.market_address}
          state={initialMarket.state}
          yesBook={yesBook}
          noBook={noBook}
          selectedOutcome={outcome}
          onBuyYes={selectBuyYes}
          onBuyNo={selectBuyNo}
        />

        <OrderBook
          marketId={params.id}
          outcome={outcome}
          refreshKey={bookRefreshKey}
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
