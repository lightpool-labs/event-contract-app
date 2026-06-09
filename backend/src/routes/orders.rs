use axum::{
    extract::{Path, State},
    routing::{get, post},
    Json, Router,
};
use lightpool_sdk::{
    parse_token_contract, OrderParamsType, OrderSide, PlaceOrderParams, TimeInForce,
};
use serde::Deserialize;
use uuid::Uuid;

use crate::chain::{
    extract_order_created_from_receipt, parse_order_size, parse_price_pieces,
};
use crate::error::{AppError, AppResult};
use crate::indexer::index_order_created;
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
    pub order_type: Option<String>,
}

async fn place_order(
    State(state): State<AppState>,
    Json(body): Json<PlaceOrderRequest>,
) -> AppResult<Json<Order>> {
    if body.outcome != "yes" && body.outcome != "no" {
        return Err(AppError::BadRequest("outcome must be yes or no".into()));
    }
    if body.side != "buy" && body.side != "sell" {
        return Err(AppError::BadRequest("side must be buy or sell".into()));
    }

    let market = state
        .index
        .get_market(body.market_id)
        .await
        .ok_or_else(|| AppError::NotFound(format!("market {} not found", body.market_id)))?;

    let spot_market_str = if body.outcome == "yes" {
        &market.yes_spot_market
    } else {
        &market.no_spot_market
    };
    let outcome_token_str = if body.outcome == "yes" {
        &market.yes_token
    } else {
        &market.no_token
    };

    let spot_market = parse_token_contract(spot_market_str)
        .map_err(|e| AppError::BadRequest(format!("invalid spot market: {e}")))?;

    let token_address = if body.side == "buy" {
        parse_token_contract(&market.collateral_token)
    } else {
        parse_token_contract(outcome_token_str)
    }
    .map_err(|e| AppError::BadRequest(format!("invalid token address: {e}")))?;

    let amount = parse_order_size(&body.size)?;

    let side = if body.side == "buy" {
        OrderSide::Buy
    } else {
        OrderSide::Sell
    };

    let is_market = body.order_type.as_deref() == Some("market");
    let (order_type, limit_price) = if is_market {
        let limit_price = if body.side == "buy" {
            parse_price_pieces("100")?
        } else {
            0
        };
        (
            OrderParamsType::Market { slippage: 500 },
            limit_price,
        )
    } else {
        (
            OrderParamsType::Limit {
                tif: TimeInForce::GTC,
            },
            parse_price_pieces(&body.price)?,
        )
    };

    let signer = state
        .signer
        .dev_signer()
        .await
        .map_err(|e| AppError::Internal(format!("signer unavailable: {e}")))?;

    let params = PlaceOrderParams {
        side,
        amount,
        order_type,
        limit_price,
        token_address,
    };

    let response = state
        .chain
        .place_order(&signer, spot_market, params)
        .await?;

    let created = extract_order_created_from_receipt(&response.receipt).ok_or_else(|| {
        AppError::Internal("order_created event missing from place_order receipt".into())
    })?;

    let order = index_order_created(&state.index, created)
        .await
        .ok_or_else(|| AppError::Internal("failed to index placed order".into()))?;

    Ok(Json(order))
}

async fn cancel_order(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> AppResult<Json<Order>> {
    let user = state.signer.user_address().await.to_string();

    let (mut order, chain_order_id, spot_market) = state
        .index
        .order_cancel_context(id, &user)
        .await
        .ok_or_else(|| AppError::NotFound(format!("open order {id} not found")))?;

    let chain_order_id_u64: u64 = chain_order_id
        .parse()
        .map_err(|e| AppError::Internal(format!("invalid chain order id: {e}")))?;

    let spot_market = parse_token_contract(&spot_market)
        .map_err(|e| AppError::BadRequest(format!("invalid spot market: {e}")))?;

    let signer = state
        .signer
        .dev_signer()
        .await
        .map_err(|e| AppError::Internal(format!("signer unavailable: {e}")))?;

    state
        .chain
        .cancel_order(&signer, spot_market, chain_order_id_u64)
        .await?;

    state.index.update_order_cancelled(&chain_order_id).await;

    order.status = "cancelled".into();
    Ok(Json(order))
}

async fn list_orders(State(state): State<AppState>) -> Json<Vec<Order>> {
    let user = state.signer.user_address().await;
    let mut orders = state.index.list_orders_for_user(&user.to_string()).await;

    for order in &mut orders {
        if order.question.is_empty() {
            if let Some(market) = state.index.get_market(order.market_id).await {
                order.question = market.question;
            }
        }
    }

    Json(orders)
}
