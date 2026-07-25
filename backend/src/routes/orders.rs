// Copyright (c) LightPool Labs
// Author: xiaoyu1998

use axum::{
    extract::{Path, State},
    routing::post,
    Json, Router,
};
use lightpool_sdk::{
    parse_token_contract, OrderParamsType, OrderSide, PlaceOrderParams, TimeInForce,
};
use serde::Deserialize;
use uuid::Uuid;

use crate::chain::{
    parse_order_size, parse_price_pieces, PlaceOrderPlacementContext, resolve_placed_order_from_receipt,
};
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
    pub market_slug: String,
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
        .clob
        .get_market_by_slug(body.market_slug.trim())
        .await?;

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

    let user = state.signer.user_address().await;

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

    let placement_ctx = PlaceOrderPlacementContext {
        user,
        spot_market,
        side,
        amount,
        limit_price,
        is_market,
        slippage: 500,
    };

    let resolved = resolve_placed_order_from_receipt(&response.receipt, &placement_ctx).ok_or_else(
        || AppError::Internal("order_created event missing from place_order receipt".into()),
    )?;

    let order = state
        .clob
        .index_order_from_event(
            resolved.created,
            resolved.skip_book,
            &resolved.status,
            resolved.filled_raw,
        )
        .await?;

    Ok(Json(order))
}

async fn cancel_order(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> AppResult<Json<Order>> {
    let user = state.signer.user_address().await.to_string();

    let (mut order, chain_order_id, spot_market) = state
        .clob
        .order_cancel_context(id, &user)
        .await?;

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

    state.clob.mark_order_cancelled(id, &user).await?;

    order.status = "cancelled".into();
    Ok(Json(order))
}

async fn list_orders(State(state): State<AppState>) -> AppResult<Json<Vec<Order>>> {
    let user = state.signer.user_address().await.to_string();
    let orders = state.clob.list_orders(&user).await?;
    Ok(Json(orders))
}
