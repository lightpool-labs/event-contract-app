use axum::{
    extract::{Path, State},
    routing::get,
    Json, Router,
};
use uuid::Uuid;

use crate::error::{AppError, AppResult};
use crate::models::Market;
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", get(list_markets))
        .route("/:id", get(get_market))
}

async fn list_markets(State(state): State<AppState>) -> Json<Vec<Market>> {
    Json(state.index.list_markets().await)
}

async fn get_market(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> AppResult<Json<Market>> {
    state
        .index
        .get_market(id)
        .await
        .map(Json)
        .ok_or_else(|| AppError::NotFound(format!("market {id} not found")))
}
