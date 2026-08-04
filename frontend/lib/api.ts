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
  Vault,
  VaultDepositRequest,
  VaultDepositWithdrawResponse,
  VaultsPage,
  VaultWithdrawRequest,
} from "./types";
import { getSessionToken } from "./session";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:3001/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = typeof window !== "undefined" ? getSessionToken() : null;
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
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

export type BridgeConfig = {
  eth_usdt: string | null;
  bridge: string | null;
  rpc: string;
  lp_token: string | null;
  chain_id: number;
  cash_token_symbol: string;
};

export type PreparedLpTx = {
  digest_hex: string;
  unsigned_tx_hex: string;
  eip712: {
    domain: {
      name: string;
      version: string;
      chainId: number;
      verifyingContract: string;
    };
    types: {
      LightPoolTx: Array<{ name: string; type: string }>;
    };
    primaryType: string;
    message: {
      digest: string;
    };
  };
};

export type AgentStatus = {
  agent_address: string;
  authorized: boolean;
  lp_address: string;
};

export const api = {
  health: () => request<{ status: string }>("/health"),
  ready: () => request<{ status: string; node: boolean }>("/ready"),
  authNonce: (address: string) =>
    request<{ address: string; nonce: string; message: string }>("/auth/nonce", {
      method: "POST",
      body: JSON.stringify({ address }),
    }),
  authVerify: (address: string, signature: string) =>
    request<{
      token: string;
      address: string;
      agent_address: string;
      agent_authorized: boolean;
    }>("/auth/verify", {
      method: "POST",
      body: JSON.stringify({ address, signature }),
    }),
  getAgent: () => request<AgentStatus>("/account/agent"),
  prepareSetAgent: () =>
    request<PreparedLpTx>("/account/agent/prepare-set-agent", {
      method: "POST",
      body: "{}",
    }),
  submitSetAgent: (signature: string, unsigned_tx_hex: string) =>
    request<{ digest: string; status: string }>("/account/agent/submit", {
      method: "POST",
      body: JSON.stringify({ signature, unsigned_tx_hex }),
    }),
  getBridgeConfig: () => request<BridgeConfig>("/bridge/config"),
  prepareBridgeWithdraw: (amount: string, evm_recipient: string) =>
    request<PreparedLpTx>("/bridge/withdraw/prepare", {
      method: "POST",
      body: JSON.stringify({ amount, evm_recipient }),
    }),
  submitBridgeWithdraw: (signature: string, unsigned_tx_hex: string) =>
    request<{ digest: string; status: string }>("/bridge/withdraw/submit", {
      method: "POST",
      body: JSON.stringify({ signature, unsigned_tx_hex }),
    }),
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
  listVaults: async (params?: {
    limit?: number;
    offset?: number;
    manager?: string;
  }) => {
    if (!params) {
      const all: Vault[] = [];
      const limit = 100;
      let offset = 0;

      while (true) {
        const page = await request<VaultsPage>(
          `/vaults?limit=${limit}&offset=${offset}`,
        );
        all.push(...page.vaults);
        if (all.length >= page.total || page.vaults.length < limit) {
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
    if (params.manager) {
      search.set("manager", params.manager);
    }

    const query = search.toString();
    const page = await request<VaultsPage>(`/vaults${query ? `?${query}` : ""}`);
    return page.vaults;
  },
  getVault: (address: string) => request<Vault>(`/vaults/${address}`),
  depositVault: (address: string, body: VaultDepositRequest) =>
    request<VaultDepositWithdrawResponse>(
      `/vaults/${encodeURIComponent(address)}/deposit`,
      {
        method: "POST",
        body: JSON.stringify(body),
      },
    ),
  withdrawVault: (address: string, body: VaultWithdrawRequest) =>
    request<VaultDepositWithdrawResponse>(
      `/vaults/${encodeURIComponent(address)}/withdraw`,
      {
        method: "POST",
        body: JSON.stringify(body),
      },
    ),
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
