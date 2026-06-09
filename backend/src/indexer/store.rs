use std::collections::HashMap;
use std::sync::Arc;

use tokio::sync::RwLock;
use uuid::Uuid;

use crate::models::{Market, Order};

#[derive(Debug, Clone, Default)]
pub struct IndexedBlockHead {
    pub block_num: u64,
    pub digest: String,
    pub tx_count: usize,
    pub connected: bool,
}

pub type SharedIndexedBlockHead = Arc<RwLock<IndexedBlockHead>>;

#[derive(Debug, Clone)]
struct SpotMarketRef {
    market_id: Uuid,
    outcome: String,
}

#[derive(Debug, Clone)]
pub(crate) struct StoredOrder {
    order: Order,
    user_address: String,
    chain_order_id: String,
    filled_raw: u64,
    size_raw: u64,
}

#[derive(Debug, Clone)]
struct CashToken {
    symbol: String,
    address: String,
}

#[derive(Default)]
struct IndexStoreInner {
    markets: HashMap<Uuid, Market>,
    spot_to_market: HashMap<String, SpotMarketRef>,
    orders: HashMap<Uuid, StoredOrder>,
    chain_order_index: HashMap<String, Uuid>,
    question_by_hash: HashMap<String, String>,
    cash_token: Option<CashToken>,
}

pub struct IndexStore {
    inner: RwLock<IndexStoreInner>,
}

pub type SharedIndexStore = Arc<IndexStore>;

impl IndexStore {
    pub fn new() -> Self {
        Self {
            inner: RwLock::new(IndexStoreInner::default()),
        }
    }

    pub async fn list_markets(&self) -> Vec<Market> {
        let inner = self.inner.read().await;
        let mut markets: Vec<Market> = inner.markets.values().cloned().collect();
        markets.sort_by_key(|m| m.resolution_deadline);
        markets
    }

    pub async fn get_market(&self, id: Uuid) -> Option<Market> {
        self.inner.read().await.markets.get(&id).cloned()
    }

    pub async fn list_orders_for_user(&self, user_address: &str) -> Vec<Order> {
        let inner = self.inner.read().await;
        inner
            .orders
            .values()
            .filter(|stored| stored.user_address.eq_ignore_ascii_case(user_address))
            .map(|stored| stored.order.clone())
            .collect()
    }

    pub async fn register_question(&self, question: &str) {
        let hash = crate::chain::compute_question_hash(question);
        let key = hex::encode(hash);
        self.inner
            .write()
            .await
            .question_by_hash
            .insert(key, question.to_string());
    }

    pub async fn question_for_hash(&self, hash: &[u8; 32]) -> Option<String> {
        let key = hex::encode(hash);
        self.inner.read().await.question_by_hash.get(&key).cloned()
    }

    pub async fn set_cash_token(&self, symbol: &str, address: &str) {
        if !symbol.eq_ignore_ascii_case("USDT") {
            return;
        }
        self.inner.write().await.cash_token = Some(CashToken {
            symbol: symbol.to_string(),
            address: address.to_string(),
        });
    }

    pub async fn balance_token_specs(&self) -> Vec<(String, String)> {
        let inner = self.inner.read().await;
        let mut specs = Vec::new();

        if let Some(cash) = &inner.cash_token {
            specs.push((cash.symbol.clone(), cash.address.clone()));
        }

        for market in inner.markets.values() {
            specs.push(("YES".into(), market.yes_token.clone()));
            specs.push(("NO".into(), market.no_token.clone()));
        }

        specs
    }

    pub async fn upsert_market(&self, market: Market) {
        let mut inner = self.inner.write().await;
        inner
            .spot_to_market
            .insert(market.yes_spot_market.clone(), SpotMarketRef {
                market_id: market.id,
                outcome: "yes".into(),
            });
        inner
            .spot_to_market
            .insert(market.no_spot_market.clone(), SpotMarketRef {
                market_id: market.id,
                outcome: "no".into(),
            });
        inner.markets.insert(market.id, market);
    }

    pub async fn update_market_state(&self, market_address: &str, state: &str) {
        let mut inner = self.inner.write().await;
        for market in inner.markets.values_mut() {
            if market.market_address == market_address {
                market.state = state.to_string();
            }
        }
    }

    pub async fn lookup_spot_market(&self, spot_market: &str) -> Option<(Uuid, String)> {
        let inner = self.inner.read().await;
        inner.spot_to_market.get(spot_market).map(|spot| {
            (spot.market_id, spot.outcome.clone())
        })
    }

    pub async fn insert_order(
        &self,
        order: Order,
        user_address: String,
        chain_order_id: String,
        size_raw: u64,
    ) {
        let stored = StoredOrder {
            order: order.clone(),
            user_address,
            chain_order_id: chain_order_id.clone(),
            filled_raw: 0,
            size_raw,
        };
        let mut inner = self.inner.write().await;
        inner.chain_order_index.insert(chain_order_id, order.id);
        inner.orders.insert(order.id, stored);
    }

    pub async fn update_order_cancelled(&self, chain_order_id: &str) {
        let mut inner = self.inner.write().await;
        let Some(order_id) = inner.chain_order_index.get(chain_order_id).copied() else {
            return;
        };
        if let Some(stored) = inner.orders.get_mut(&order_id) {
            stored.order.status = "cancelled".into();
        }
    }

    pub async fn update_order_fill(
        &self,
        chain_order_id: &str,
        fill_amount: u64,
        remaining_amount: u64,
        is_fully_filled: bool,
    ) {
        let mut inner = self.inner.write().await;
        let Some(order_id) = inner.chain_order_index.get(chain_order_id).copied() else {
            return;
        };
        let Some(stored) = inner.orders.get_mut(&order_id) else {
            return;
        };

        stored.filled_raw = stored.filled_raw.saturating_add(fill_amount);
        stored.order.status = if is_fully_filled || remaining_amount == 0 {
            "filled".into()
        } else {
            "open".into()
        };
    }
}

pub fn new_head() -> SharedIndexedBlockHead {
    Arc::new(RwLock::new(IndexedBlockHead::default()))
}

pub fn market_uuid(market_address: &str) -> Uuid {
    Uuid::new_v5(&Uuid::NAMESPACE_OID, market_address.as_bytes())
}

pub fn question_from_hash(hash: &[u8; 32]) -> String {
    let end = hash.iter().position(|&b| b == 0).unwrap_or(32);
    String::from_utf8_lossy(&hash[..end]).trim().to_string()
}
