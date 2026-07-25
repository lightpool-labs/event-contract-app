// Copyright (c) LightPool Labs
// Author: xiaoyu1998

use axum::{extract::State, routing::get, Json, Router};
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

async fn ready(State(state): State<AppState>) -> AppResult<Json<serde_json::Value>> {
    let clob_ok = state.clob.health_check().await?;

    Ok(Json(json!({
        "status": if clob_ok { "ready" } else { "degraded" },
        "clob_index": clob_ok,
    })))
}
