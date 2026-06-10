use lightpool_sdk::lightpool_types::SignedTransaction;
use lightpool_sdk::spot_events::OrderCreatedEvent;
use lightpool_sdk::types::SubmitTransactionResponse;
use lightpool_sdk::TransactionReceipt;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::error::{AppError, AppResult};
use crate::models::{BalanceEntry, BookResponse, Market, Order};

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
struct SlugResponse {
    slug: String,
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

    pub async fn health_check(&self) -> AppResult<bool> {
        let ready: ReadyResponse = self.get_json("/api/health/ready").await?;
        Ok(ready.node && ready.status == "ready")
    }

    pub async fn list_markets(&self) -> AppResult<Vec<Market>> {
        self.get_json("/api/markets").await
    }

    pub async fn get_market_by_slug(&self, slug: &str) -> AppResult<Market> {
        self.get_json(&format!("/api/markets/slug/{slug}")).await
    }

    pub async fn register_question(
        &self,
        question: &str,
        slug: &str,
        icon_url: Option<&str>,
    ) -> AppResult<()> {
        #[derive(Serialize)]
        struct Body<'a> {
            question: &'a str,
            slug: &'a str,
            #[serde(skip_serializing_if = "Option::is_none")]
            icon_url: Option<&'a str>,
        }
        let _: serde_json::Value = self
            .post_json(
                "/api/markets/index/register-question",
                &Body {
                    question,
                    slug,
                    icon_url,
                },
            )
            .await?;
        Ok(())
    }

    pub async fn allocate_slug(&self, question: &str) -> AppResult<String> {
        #[derive(Serialize)]
        struct Body<'a> {
            question: &'a str,
        }
        let response: SlugResponse = self
            .post_json("/api/markets/index/allocate-slug", &Body { question })
            .await?;
        Ok(response.slug)
    }

    pub async fn position_token_specs(&self) -> AppResult<Vec<BalanceTokenSpec>> {
        self.get_json("/api/markets/index/position-token-specs")
            .await
    }

    pub async fn get_book(
        &self,
        account: &str,
        spot_market: &str,
        depth: u32,
    ) -> AppResult<BookResponse> {
        self.get_json(&format!(
            "/api/spot/{spot_market}/book?account={account}&depth={depth}"
        ))
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

    pub async fn index_order_from_event(&self, event: OrderCreatedEvent) -> AppResult<Order> {
        self.post_json("/api/orders/index/from-event", &event).await
    }
}
