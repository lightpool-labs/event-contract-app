"use client";

import Link from "next/link";
import type { BalanceEntry, Order } from "@/lib/types";

type Tab = "assets" | "open" | "history";

const tabs: { id: Tab; label: string }[] = [
  { id: "assets", label: "Assets" },
  { id: "open", label: "Open Orders" },
  { id: "history", label: "Order History" },
];

function tabHref(tab: Tab) {
  return tab === "assets" ? "/dashboard" : `/dashboard?tab=${tab}`;
}

function isActiveTab(current: Tab, tab: Tab) {
  return current === tab;
}

export default function DashboardTabs({
  activeTab,
  balances,
  orders,
  error,
}: {
  activeTab: Tab;
  balances: BalanceEntry[];
  orders: Order[];
  error: string | null;
}) {
  const openOrders = orders.filter((o) => o.status === "open");
  const historyOrders = orders.filter((o) => o.status !== "open");

  return (
    <div>
      <div className="mb-6 flex gap-1 border-b border-slate-200">
        {tabs.map((tab) => (
          <Link
            key={tab.id}
            href={tabHref(tab.id)}
            className={[
              "px-4 py-2 text-sm font-medium",
              isActiveTab(activeTab, tab.id)
                ? "border-b-2 border-slate-900 text-slate-900"
                : "text-slate-500 hover:text-slate-700",
            ].join(" ")}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {error && (
        <div className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {activeTab === "assets" && (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100 text-left">
              <tr>
                <th className="px-4 py-3">Symbol</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Locked</th>
                <th className="px-4 py-3">Available</th>
              </tr>
            </thead>
            <tbody>
              {balances.map((b) => (
                <tr key={b.symbol} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium">{b.symbol}</td>
                  <td className="px-4 py-3">{b.total}</td>
                  <td className="px-4 py-3">{b.locked}</td>
                  <td className="px-4 py-3">{b.available}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!error && balances.length === 0 && (
            <p className="px-4 py-6 text-sm text-slate-500">No assets yet.</p>
          )}
        </div>
      )}

      {activeTab === "open" && (
        <OrdersTable orders={openOrders} emptyMessage="No open orders." showError={!!error} />
      )}

      {activeTab === "history" && (
        <OrdersTable orders={historyOrders} emptyMessage="No order history." showError={!!error} />
      )}
    </div>
  );
}

function OrdersTable({
  orders,
  emptyMessage,
  showError,
}: {
  orders: Order[];
  emptyMessage: string;
  showError: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-100 text-left">
          <tr>
            <th className="px-4 py-3">Outcome</th>
            <th className="px-4 py-3">Side</th>
            <th className="px-4 py-3">Price</th>
            <th className="px-4 py-3">Size</th>
            <th className="px-4 py-3">Status</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.id} className="border-t border-slate-100">
              <td className="px-4 py-3 uppercase">{order.outcome}</td>
              <td className="px-4 py-3 capitalize">{order.side}</td>
              <td className="px-4 py-3">{order.price}</td>
              <td className="px-4 py-3">{order.size}</td>
              <td className="px-4 py-3">{order.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!showError && orders.length === 0 && (
        <p className="px-4 py-6 text-sm text-slate-500">{emptyMessage}</p>
      )}
    </div>
  );
}
