use axum::{extract::State, routing::get, Json, Router};
use lightpool_sdk::parse_token_contract;

use crate::chain::format_token_amount;
use crate::error::AppResult;
use crate::models::BalanceEntry;
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new().route("/balances", get(get_balances))
}

async fn get_balances(State(state): State<AppState>) -> AppResult<Json<Vec<BalanceEntry>>> {
    let account = state.signer.user_address().await;
    let mut entries = Vec::new();

    for (symbol, token_str) in state.index.balance_token_specs().await {
        let token_contract = match parse_token_contract(&token_str) {
            Ok(contract) => contract,
            Err(e) => {
                tracing::warn!(symbol = %symbol, token = %token_str, error = %e, "skip balance query");
                entries.push(zero_balance_entry(symbol, token_str));
                continue;
            }
        };

        match state.chain.get_balance(account, token_contract).await {
            Ok(balance) => {
                entries.push(BalanceEntry {
                    token: token_str,
                    symbol,
                    total: format_token_amount(balance.total),
                    locked: format_token_amount(balance.locked),
                    available: format_token_amount(balance.available),
                });
            }
            Err(e) => {
                tracing::warn!(symbol = %symbol, error = %e, "get_balance failed, returning zero");
                entries.push(zero_balance_entry(symbol, token_str));
            }
        }
    }

    Ok(Json(entries))
}

fn zero_balance_entry(symbol: String, token: String) -> BalanceEntry {
    BalanceEntry {
        token,
        symbol,
        total: "0".into(),
        locked: "0".into(),
        available: "0".into(),
    }
}
