// Copyright (c) LightPool Labs
// Author: xiaoyu1998

use std::collections::HashSet;

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
    let mut seen_addresses = HashSet::new();

    let mut push_token = |symbol: &str, address: &str| {
        let key = address.trim().to_ascii_lowercase();
        if key.is_empty() || !seen_addresses.insert(key) {
            return;
        }
        tokens.push(BalanceTokenSpec {
            symbol: symbol.to_string(),
            address: address.trim().to_string(),
        });
    };

    if let Some(cash) = state.cash_token.get().await {
        push_token(&cash.symbol, &cash.address);
    }

    let position_specs = state.clob.position_token_specs().await?;
    tokens.extend(position_specs);

    let entries = state.clob.get_balances(&account, &tokens).await?;
    Ok(Json(entries))
}
