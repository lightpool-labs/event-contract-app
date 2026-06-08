import type { BalanceEntry, Market, Order, PlaceOrderRequest } from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:3001/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed: ${res.status}`);
  }

  return res.json() as Promise<T>;
}

export const api = {
  health: () => request<{ status: string }>("/health"),
  ready: () => request<{ status: string; node: boolean }>("/ready"),
  listMarkets: () => request<Market[]>("/markets"),
  getMarket: (id: string) => request<Market>(`/markets/${id}`),
  listOrders: () => request<Order[]>("/orders"),
  placeOrder: (body: PlaceOrderRequest) =>
    request<Order>("/orders", { method: "POST", body: JSON.stringify(body) }),
  cancelOrder: (id: string) =>
    request<Order>(`/orders/${id}/cancel`, { method: "POST" }),
  getBalances: () => request<BalanceEntry[]>("/account/balances"),
};
