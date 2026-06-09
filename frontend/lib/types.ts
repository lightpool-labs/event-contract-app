export type Market = {
  id: string;
  question: string;
  market_address: string;
  collateral_token: string;
  yes_token: string;
  no_token: string;
  yes_spot_market: string;
  no_spot_market: string;
  state: string;
  resolution_deadline: number;
};

export type Order = {
  id: string;
  market_id: string;
  outcome: string;
  side: string;
  price: string;
  size: string;
  status: string;
};

export type BalanceEntry = {
  token: string;
  symbol: string;
  total: string;
  locked: string;
  available: string;
};

export type PlaceOrderRequest = {
  market_id: string;
  outcome: "yes" | "no";
  side: "buy" | "sell";
  price: string;
  size: string;
};

export type CreateTokenRequest = {
  name: string;
  symbol: string;
  total_supply: number;
  mintable?: boolean;
};

export type CreateTokenResponse = {
  token_address: string;
  tx_digest: string;
  name: string;
  symbol: string;
  creator: string;
};

export type CreateEventContractRequest = {
  question: string;
  collateral_token: string;
  oracle?: string;
  resolution_deadline: number;
  tick_size?: number;
  min_order_size?: number;
  maker_fee_bps?: number;
  taker_fee_bps?: number;
  allow_market_orders?: boolean;
};

export type CreateEventContractResponse = {
  market_id: string;
  question: string;
  market_address: string;
  collateral_token: string;
  yes_token: string;
  no_token: string;
  yes_spot_market: string;
  no_spot_market: string;
  state: string;
  resolution_deadline: number;
  tx_digest: string;
  creator: string;
};
