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
