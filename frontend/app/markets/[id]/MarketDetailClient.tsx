"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { Market } from "@/lib/types";

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
  const [price, setPrice] = useState("0.50");
  const [size, setSize] = useState("100");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!initialMarket) {
    return <p className="text-sm text-slate-500">Market not found.</p>;
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
      });
      setMessage(`Order placed: ${order.id} (${order.status})`);
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Order failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <section>
        <h1 className="mb-2 text-2xl font-semibold">{initialMarket.question}</h1>
        <p className="mb-4 text-sm text-slate-600">State: {initialMarket.state}</p>
        <dl className="grid gap-2 text-sm text-slate-600">
          <div>
            <dt className="font-medium text-slate-800">Market</dt>
            <dd>{initialMarket.market_address}</dd>
          </div>
          <div>
            <dt className="font-medium text-slate-800">YES spot</dt>
            <dd>{initialMarket.yes_spot_market}</dd>
          </div>
          <div>
            <dt className="font-medium text-slate-800">NO spot</dt>
            <dd>{initialMarket.no_spot_market}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-4 font-medium">Place order</h2>
        <form onSubmit={onSubmit} className="space-y-3">
          <label className="block text-sm">
            Outcome
            <select
              className="mt-1 w-full rounded border px-3 py-2"
              value={outcome}
              onChange={(e) => setOutcome(e.target.value as "yes" | "no")}
            >
              <option value="yes">YES</option>
              <option value="no">NO</option>
            </select>
          </label>
          <label className="block text-sm">
            Side
            <select
              className="mt-1 w-full rounded border px-3 py-2"
              value={side}
              onChange={(e) => setSide(e.target.value as "buy" | "sell")}
            >
              <option value="buy">Buy</option>
              <option value="sell">Sell</option>
            </select>
          </label>
          <label className="block text-sm">
            Price
            <input
              className="mt-1 w-full rounded border px-3 py-2"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            Size
            <input
              className="mt-1 w-full rounded border px-3 py-2"
              value={size}
              onChange={(e) => setSize(e.target.value)}
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            {loading ? "Submitting..." : "Submit order"}
          </button>
        </form>
        {message && <p className="mt-3 text-sm text-slate-600">{message}</p>}
      </section>
    </div>
  );
}
