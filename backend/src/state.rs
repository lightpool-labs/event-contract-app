use std::sync::Arc;

use crate::cash_token::{CashTokenStore, SharedCashTokenStore};
use crate::chain::{ChainClient, LocalSignerService, SharedSignerService};
use crate::clob::ClobIndexClient;
use crate::config::Config;

#[derive(Clone)]
pub struct AppState {
    pub config: Config,
    pub clob: Arc<ClobIndexClient>,
    pub chain: Arc<ChainClient>,
    pub signer: SharedSignerService,
    pub cash_token: SharedCashTokenStore,
}

impl AppState {
    pub fn new(config: Config) -> Self {
        let clob = Arc::new(ClobIndexClient::new(&config.clob_index_url));
        let chain = Arc::new(ChainClient::new(clob.clone()));
        let signer = Arc::new(
            LocalSignerService::from_config(&config)
                .expect("failed to initialize dev signer from DEV_SECRET_KEY"),
        );
        let cash_token = Arc::new(CashTokenStore::from_config(&config));

        Self {
            config,
            clob,
            chain,
            signer,
            cash_token,
        }
    }
}
