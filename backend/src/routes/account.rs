use axum::{routing::get, Json, Router};

use crate::models::BalanceEntry;
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new().route("/balances", get(get_balances))
}

async fn get_balances() -> Json<Vec<BalanceEntry>> {
    Json(AppState::seed_balances())
}
