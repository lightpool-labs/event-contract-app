use axum::{routing::get, Json, Router};
use serde_json::json;

use crate::error::AppResult;
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/health", get(health))
        .route("/ready", get(ready))
}

async fn health() -> Json<serde_json::Value> {
    Json(json!({ "status": "ok" }))
}

async fn ready(state: axum::extract::State<AppState>) -> AppResult<Json<serde_json::Value>> {
    let node_ok = state.chain.health_check().await?;
    Ok(Json(json!({
        "status": if node_ok { "ready" } else { "degraded" },
        "node": node_ok,
    })))
}
