use std::sync::Arc;

use crate::chain::{ChainClient, LocalSignerService, SharedSignerService};
use crate::config::Config;
use crate::models::{BalanceEntry, Market, Order};
use uuid::Uuid;

#[derive(Clone)]
pub struct AppState {
    pub config: Config,
    pub chain: Arc<ChainClient>,
    pub signer: SharedSignerService,
}

impl AppState {
    pub fn new(config: Config) -> Self {
        let chain = Arc::new(ChainClient::new(&config.lightpool_rpc_url));
        Self {
            config,
            chain,
            signer: Arc::new(LocalSignerService::new()),
        }
    }

    pub fn seed_markets() -> Vec<Market> {
        vec![Market {
            id: Uuid::parse_str("00000000-0000-0000-0000-000000000001").expect("valid uuid"),
            question: "Will BTC reach 100k by end of 2026?".into(),
            market_address: "0x0000000000000000".into(),
            collateral_token: "0x0000000000000000".into(),
            yes_token: "0x0000000000000000".into(),
            no_token: "0x0000000000000000".into(),
            yes_spot_market: "0x0000000000000000".into(),
            no_spot_market: "0x0000000000000000".into(),
            state: "Active".into(),
            resolution_deadline: 1_767_225_600,
        }]
    }

    pub fn seed_orders() -> Vec<Order> {
        vec![]
    }

    pub fn seed_balances() -> Vec<BalanceEntry> {
        vec![
            BalanceEntry {
                token: "0x0000000000000000".into(),
                symbol: "USDT".into(),
                total: "0".into(),
                locked: "0".into(),
                available: "0".into(),
            },
            BalanceEntry {
                token: "0x0000000000000000".into(),
                symbol: "YES".into(),
                total: "0".into(),
                locked: "0".into(),
                available: "0".into(),
            },
            BalanceEntry {
                token: "0x0000000000000000".into(),
                symbol: "NO".into(),
                total: "0".into(),
                locked: "0".into(),
                available: "0".into(),
            },
        ]
    }
}
