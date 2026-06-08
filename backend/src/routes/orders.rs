use axum::{
    extract::{Path, State},
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use uuid::Uuid;

use crate::error::{AppError, AppResult};
use crate::models::Order;
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", post(place_order).get(list_orders))
        .route("/:id/cancel", post(cancel_order))
}

#[derive(Debug, Deserialize)]
pub struct PlaceOrderRequest {
    pub market_id: Uuid,
    pub outcome: String,
    pub side: String,
    pub price: String,
    pub size: String,
}

async fn place_order(
    State(_state): State<AppState>,
    Json(body): Json<PlaceOrderRequest>,
) -> AppResult<Json<Order>> {
    if body.outcome != "yes" && body.outcome != "no" {
        return Err(AppError::BadRequest("outcome must be yes or no".into()));
    }
    if body.side != "buy" && body.side != "sell" {
        return Err(AppError::BadRequest("side must be buy or sell".into()));
    }

    Ok(Json(Order {
        id: Uuid::new_v4(),
        market_id: body.market_id,
        outcome: body.outcome,
        side: body.side,
        price: body.price,
        size: body.size,
        status: "open".into(),
    }))
}

async fn cancel_order(
    State(_state): State<AppState>,
    Path(id): Path<Uuid>,
) -> AppResult<Json<Order>> {
    Ok(Json(Order {
        id,
        market_id: Uuid::nil(),
        outcome: "yes".into(),
        side: "buy".into(),
        price: "0".into(),
        size: "0".into(),
        status: "cancelled".into(),
    }))
}

async fn list_orders(State(_state): State<AppState>) -> Json<Vec<Order>> {
    Json(AppState::seed_orders())
}
