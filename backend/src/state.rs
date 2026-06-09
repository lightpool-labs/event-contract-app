use std::sync::Arc;

use crate::chain::{ChainClient, LocalSignerService, SharedSignerService};
use crate::config::Config;
use crate::indexer::{IndexStore, SharedIndexStore, SharedIndexedBlockHead, new_head};
use crate::models::BalanceEntry;

#[derive(Clone)]
pub struct AppState {
    pub config: Config,
    pub chain: Arc<ChainClient>,
    pub signer: SharedSignerService,
    pub indexed_head: SharedIndexedBlockHead,
    pub index: SharedIndexStore,
}

impl AppState {
    pub fn new(config: Config) -> Self {
        let chain = Arc::new(ChainClient::new(&config.lightpool_rpc_url));
        Self {
            config,
            chain,
            signer: Arc::new(LocalSignerService::new()),
            indexed_head: new_head(),
            index: Arc::new(IndexStore::new()),
        }
    }

    pub fn seed_balance_specs() -> Vec<(&'static str, &'static str)> {
        vec![
            ("USDT", "0x0000000000000000"),
            ("YES", "0x0000000000000000"),
            ("NO", "0x0000000000000000"),
        ]
    }

    pub fn seed_balances() -> Vec<BalanceEntry> {
        Self::seed_balance_specs()
            .into_iter()
            .map(|(symbol, token)| BalanceEntry {
                token: token.into(),
                symbol: symbol.into(),
                total: "0".into(),
                locked: "0".into(),
                available: "0".into(),
            })
            .collect()
    }
}
