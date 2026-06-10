import type {
  BalanceEntry,
  CashToken,
  CreateEventContractRequest,
  CreateEventContractResponse,
  CreateTokenRequest,
  CreateTokenResponse,
  Event,
  MintBurnRequest,
  MintBurnResponse,
  Order,
  PlaceOrderRequest,
} from "./types";

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
  listEvents: () => request<Event[]>("/events"),
  getEvent: (slug: string) => request<Event>(`/events/${slug}`),
  listOrders: () => request<Order[]>("/orders"),
  placeOrder: (body: PlaceOrderRequest) =>
    request<Order>("/orders", { method: "POST", body: JSON.stringify(body) }),
  cancelOrder: (id: string) =>
    request<Order>(`/orders/${id}/cancel`, { method: "POST" }),
  getBalances: () => request<BalanceEntry[]>("/account/balances"),
  getAccount: () => request<{ address: string }>("/account"),
  getCashToken: () => request<CashToken | null>("/admin/cash-token"),
  createToken: (body: CreateTokenRequest) =>
    request<CreateTokenResponse>("/admin/tokens", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  createEventContract: (body: CreateEventContractRequest) =>
    request<CreateEventContractResponse>("/admin/event-contracts", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  mintEvent: (slug: string, body: MintBurnRequest) =>
    request<MintBurnResponse>(`/events/${slug}/mint`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  burnEvent: (slug: string, body: MintBurnRequest) =>
    request<MintBurnResponse>(`/events/${slug}/burn`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
};
