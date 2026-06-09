use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Market {
    pub id: Uuid,
    pub question: String,
    pub market_address: String,
    pub collateral_token: String,
    pub yes_token: String,
    pub no_token: String,
    pub yes_spot_market: String,
    pub no_spot_market: String,
    pub state: String,
    pub resolution_deadline: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Order {
    pub id: Uuid,
    pub market_id: Uuid,
    pub outcome: String,
    pub side: String,
    pub price: String,
    pub size: String,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BalanceEntry {
    pub token: String,
    pub symbol: String,
    pub total: String,
    pub locked: String,
    pub available: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateTokenRequest {
    pub name: String,
    pub symbol: String,
    pub total_supply: u64,
    pub mintable: Option<bool>,
}

#[derive(Debug, Serialize)]
pub struct CreateTokenResponse {
    pub token_address: String,
    pub tx_digest: String,
    pub name: String,
    pub symbol: String,
    pub creator: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateEventContractRequest {
    pub question: String,
    pub collateral_token: String,
    pub oracle: Option<String>,
    pub resolution_deadline: u64,
    pub tick_size: Option<u64>,
    pub min_order_size: Option<u64>,
    pub maker_fee_bps: Option<u16>,
    pub taker_fee_bps: Option<u16>,
    pub allow_market_orders: Option<bool>,
}

#[derive(Debug, Serialize)]
pub struct CreateEventContractResponse {
    pub market_id: Uuid,
    pub question: String,
    pub market_address: String,
    pub collateral_token: String,
    pub yes_token: String,
    pub no_token: String,
    pub yes_spot_market: String,
    pub no_spot_market: String,
    pub state: String,
    pub resolution_deadline: u64,
    pub tx_digest: String,
    pub creator: String,
}
