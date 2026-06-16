use lightpool_sdk::lightpool_types::SignedTransaction;
use lightpool_sdk::spot_events::OrderCreatedEvent;
use lightpool_sdk::types::SubmitTransactionResponse;
use lightpool_sdk::TransactionReceipt;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::error::{AppError, AppResult};
use crate::models::{BalanceEntry, Market, MarketsPage, Order, QueryMarketsParams};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BalanceTokenSpec {
    pub symbol: String,
    pub address: String,
}

#[derive(Debug, Deserialize)]
struct ErrorBody {
    error: String,
}

#[derive(Debug, Deserialize)]
struct ReadyResponse {
    status: String,
    node: bool,
}

#[derive(Debug, Deserialize)]
struct CancelContextResponse {
    order: Order,
    chain_order_id: String,
    spot_market: String,
}

#[derive(Debug, Deserialize)]
struct SubmitTxResponse {
    digest: String,
    receipt: TransactionReceipt,
}

pub struct ClobIndexClient {
    client: Client,
    base_url: String,
}

impl ClobIndexClient {
    pub fn new(base_url: impl Into<String>) -> Self {
        let client = Client::builder()
            .pool_max_idle_per_host(0)
            .build()
            .expect("failed to build clob-index HTTP client");
        Self {
            client,
            base_url: base_url.into().trim_end_matches('/').to_string(),
        }
    }

    async fn get_json<T: for<'de> Deserialize<'de>>(&self, path: &str) -> AppResult<T> {
        let url = format!("{}{}", self.base_url, path);
        let response = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| AppError::Internal(format!("clob-index request failed: {e}")))?;

        Self::decode_response(response).await
    }

    async fn post_json<B: Serialize, T: for<'de> Deserialize<'de>>(
        &self,
        path: &str,
        body: &B,
    ) -> AppResult<T> {
        let url = format!("{}{}", self.base_url, path);
        let response = self
            .client
            .post(&url)
            .json(body)
            .send()
            .await
            .map_err(|e| AppError::Internal(format!("clob-index request failed: {e}")))?;

        Self::decode_response(response).await
    }

    async fn decode_response<T: for<'de> Deserialize<'de>>(
        response: reqwest::Response,
    ) -> AppResult<T> {
        let status = response.status();
        if status.is_success() {
            return response
                .json::<T>()
                .await
                .map_err(|e| AppError::Internal(format!("decode clob-index response: {e}")));
        }

        let body = response
            .json::<ErrorBody>()
            .await
            .unwrap_or(ErrorBody {
                error: "unknown clob-index error".into(),
            });

        let message = body.error;
        if status.as_u16() == 404 {
            return Err(AppError::NotFound(message));
        }
        if status.as_u16() == 400 {
            return Err(AppError::BadRequest(message));
        }
        Err(AppError::Internal(message))
    }

    async fn get_json_with_query<T, Q>(
        &self,
        path: &str,
        query: &Q,
    ) -> AppResult<T>
    where
        T: for<'de> Deserialize<'de>,
        Q: Serialize + ?Sized,
    {
        let url = format!("{}{}", self.base_url, path);
        let response = self
            .client
            .get(&url)
            .query(query)
            .send()
            .await
            .map_err(|e| AppError::Internal(format!("clob-index request failed: {e}")))?;

        Self::decode_response(response).await
    }

    pub async fn health_check(&self) -> AppResult<bool> {
        let ready: ReadyResponse = self.get_json("/api/health/ready").await?;
        Ok(ready.node && ready.status == "ready")
    }

    pub async fn query_markets(&self, params: &QueryMarketsParams) -> AppResult<MarketsPage> {
        self.get_json_with_query("/api/markets", params).await
    }

    pub async fn fetch_all_markets(&self) -> AppResult<Vec<Market>> {
        const PAGE_LIMIT: u32 = 100;
        let mut offset = 0u32;
        let mut markets = Vec::new();

        loop {
            let page = self
                .query_markets(&QueryMarketsParams {
                    limit: Some(PAGE_LIMIT),
                    offset: Some(offset),
                    ..QueryMarketsParams::default()
                })
                .await?;

            let page_len = page.markets.len();
            markets.extend(page.markets);
            if markets.len() >= page.total || page_len == 0 {
                break;
            }
            offset = offset.saturating_add(PAGE_LIMIT);
        }

        Ok(markets)
    }

    pub async fn get_market_by_slug(&self, slug: &str) -> AppResult<Market> {
        self.get_json(&format!("/api/markets/slug/{slug}")).await
    }

    pub async fn position_token_specs(&self) -> AppResult<Vec<BalanceTokenSpec>> {
        self.get_json("/api/markets/index/position-token-specs")
            .await
    }

    pub async fn get_balances(
        &self,
        account: &str,
        tokens: &[BalanceTokenSpec],
    ) -> AppResult<Vec<BalanceEntry>> {
        #[derive(Serialize)]
        struct Body<'a> {
            tokens: &'a [BalanceTokenSpec],
        }
        self.post_json(
            &format!("/api/accounts/{account}/balances"),
            &Body { tokens },
        )
        .await
    }

    pub async fn submit_transaction(
        &self,
        tx: SignedTransaction,
    ) -> AppResult<SubmitTransactionResponse> {
        #[derive(Serialize)]
        struct Body {
            tx: SignedTransaction,
        }
        let response: SubmitTxResponse = self
            .post_json("/api/tx/submit", &Body { tx })
            .await?;
        Ok(SubmitTransactionResponse {
            digest: response.digest,
            receipt: response.receipt,
        })
    }

    pub async fn list_orders(&self, user_address: &str) -> AppResult<Vec<Order>> {
        self.get_json(&format!("/api/orders?user_address={user_address}"))
            .await
    }

    pub async fn order_cancel_context(
        &self,
        order_id: Uuid,
        user_address: &str,
    ) -> AppResult<(Order, String, String)> {
        let response: CancelContextResponse = self
            .get_json(&format!(
                "/api/orders/{order_id}/cancel-context?user_address={user_address}"
            ))
            .await?;
        Ok((
            response.order,
            response.chain_order_id,
            response.spot_market,
        ))
    }

    pub async fn mark_order_cancelled(
        &self,
        order_id: Uuid,
        user_address: &str,
    ) -> AppResult<()> {
        let _: serde_json::Value = self
            .post_json(
                &format!("/api/orders/{order_id}/cancelled?user_address={user_address}"),
                &serde_json::json!({}),
            )
            .await?;
        Ok(())
    }

    pub async fn index_order_from_event(
        &self,
        event: OrderCreatedEvent,
        skip_book: bool,
        status: &str,
        filled_raw: u64,
    ) -> AppResult<Order> {
        self.post_json(
            "/api/orders/index/from-event",
            &serde_json::json!({
                "event": event,
                "skip_book": skip_book,
                "status": status,
                "filled_raw": filled_raw,
            }),
        )
        .await
    }
}
