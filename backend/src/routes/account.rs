use axum::{extract::State, routing::get, Json, Router};
use serde::Serialize;

use crate::clob::BalanceTokenSpec;
use crate::error::AppResult;
use crate::models::BalanceEntry;
use crate::state::AppState;

#[derive(Serialize)]
pub struct AccountResponse {
    pub address: String,
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", get(get_account))
        .route("/balances", get(get_balances))
}

async fn get_account(State(state): State<AppState>) -> Json<AccountResponse> {
    let address = state.signer.user_address().await.to_string();
    Json(AccountResponse { address })
}

async fn get_balances(State(state): State<AppState>) -> AppResult<Json<Vec<BalanceEntry>>> {
    let account = state.signer.user_address().await.to_string();

    let mut tokens: Vec<BalanceTokenSpec> = Vec::new();
    if let Some(cash) = state.cash_token.get().await {
        tokens.push(BalanceTokenSpec {
            symbol: cash.symbol,
            address: cash.address,
        });
    }

    let position_specs = state.clob.position_token_specs().await?;
    tokens.extend(position_specs);

    let entries = state.clob.get_balances(&account, &tokens).await?;
    Ok(Json(entries))
}
