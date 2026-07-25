// Copyright (c) LightPool Labs
// Author: xiaoyu1998

use std::sync::Arc;

use tokio::sync::RwLock;

use crate::config::Config;

#[derive(Debug, Clone)]
pub struct CashToken {
    pub symbol: String,
    pub address: String,
}

#[derive(Default)]
struct CashTokenInner {
    token: Option<CashToken>,
}

pub struct CashTokenStore {
    inner: RwLock<CashTokenInner>,
}

pub type SharedCashTokenStore = Arc<CashTokenStore>;

impl CashTokenStore {
    pub fn from_config(config: &Config) -> Self {
        let token = config.cash_token_address.as_ref().map(|address| {
            tracing::info!(
                symbol = %config.cash_token_symbol,
                address = %address.trim(),
                "loaded cash token from CASH_TOKEN_ADDRESS"
            );
            CashToken {
                symbol: config.cash_token_symbol.clone(),
                address: address.trim().to_string(),
            }
        });

        if token.is_none() {
            tracing::warn!(
                "CASH_TOKEN_ADDRESS not set; cash balance queries will be empty until a token is created via admin or env is configured"
            );
        }

        Self {
            inner: RwLock::new(CashTokenInner { token }),
        }
    }

    pub async fn set(&self, symbol: impl Into<String>, address: &str) {
        let symbol = symbol.into();
        tracing::info!(symbol = %symbol, address = %address, "updated cash token in memory");
        self.inner.write().await.token = Some(CashToken {
            symbol,
            address: address.to_string(),
        });
    }

    pub async fn get(&self) -> Option<CashToken> {
        self.inner.read().await.token.clone()
    }
}
