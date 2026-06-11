import type {
  BalanceEntry,
  CashToken,
  CreateEventContractRequest,
  CreateEventContractResponse,
  CreateTokenRequest,
  CreateTokenResponse,
  Market,
  MarketsPage,
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
  listMarkets: async (params?: {
    limit?: number;
    offset?: number;
    slug?: string;
    slugs?: string;
    state?: string;
    order?: string;
    ascending?: boolean;
  }) => {
    if (!params) {
      const all: Market[] = [];
      const limit = 100;
      let offset = 0;

      while (true) {
        const page = await request<MarketsPage>(
          `/markets?limit=${limit}&offset=${offset}`,
        );
        all.push(...page.markets);
        if (all.length >= page.total || page.markets.length < limit) {
          break;
        }
        offset += limit;
      }

      return all;
    }

    const search = new URLSearchParams();
    if (params.limit !== undefined) {
      search.set("limit", String(params.limit));
    }
    if (params.offset !== undefined) {
      search.set("offset", String(params.offset));
    }
    if (params.slug) {
      search.set("slug", params.slug);
    }
    if (params.slugs) {
      search.set("slugs", params.slugs);
    }
    if (params.state) {
      search.set("state", params.state);
    }
    if (params.order) {
      search.set("order", params.order);
    }
    if (params.ascending !== undefined) {
      search.set("ascending", String(params.ascending));
    }

    const query = search.toString();
    const page = await request<MarketsPage>(`/markets${query ? `?${query}` : ""}`);
    return page.markets;
  },
  queryMarkets: (params?: {
    limit?: number;
    offset?: number;
    slug?: string;
    slugs?: string;
    state?: string;
    order?: string;
    ascending?: boolean;
  }) => {
    const search = new URLSearchParams();
    if (params?.limit !== undefined) {
      search.set("limit", String(params.limit));
    }
    if (params?.offset !== undefined) {
      search.set("offset", String(params.offset));
    }
    if (params?.slug) {
      search.set("slug", params.slug);
    }
    if (params?.slugs) {
      search.set("slugs", params.slugs);
    }
    if (params?.state) {
      search.set("state", params.state);
    }
    if (params?.order) {
      search.set("order", params.order);
    }
    if (params?.ascending !== undefined) {
      search.set("ascending", String(params.ascending));
    }

    const query = search.toString();
    return request<MarketsPage>(`/markets${query ? `?${query}` : ""}`);
  },
  getMarket: (slug: string) => request<Market>(`/markets/${slug}`),
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
  mintMarket: (slug: string, body: MintBurnRequest) =>
    request<MintBurnResponse>(`/markets/${slug}/mint`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  burnMarket: (slug: string, body: MintBurnRequest) =>
    request<MintBurnResponse>(`/markets/${slug}/burn`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
};
