use std::str::FromStr;

use axum::{extract::State, routing::post, Json, Router};

use crate::error::{AppError, AppResult};
use crate::indexer::market_uuid;
use crate::models::{
    CreateEventContractRequest, CreateEventContractResponse, CreateTokenRequest,
    CreateTokenResponse, Market,
};
use crate::state::AppState;
use lightpool_sdk::{parse_token_contract, Address};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/tokens", post(create_token))
        .route("/event-contracts", post(create_event_contract))
}

async fn create_token(
    State(state): State<AppState>,
    Json(body): Json<CreateTokenRequest>,
) -> AppResult<Json<CreateTokenResponse>> {
    let name = body.name.trim();
    let symbol = body.symbol.trim();

    if name.is_empty() {
        return Err(AppError::BadRequest("name is required".into()));
    }
    if symbol.is_empty() {
        return Err(AppError::BadRequest("symbol is required".into()));
    }
    if body.total_supply == 0 {
        return Err(AppError::BadRequest("total_supply must be greater than 0".into()));
    }

    let signer = state
        .signer
        .dev_signer()
        .await
        .map_err(|e| AppError::Internal(format!("signer unavailable: {e}")))?;

    let creator = signer.address();
    let mintable = body.mintable.unwrap_or(true);

    let result = state
        .chain
        .create_token(&signer, name, symbol, body.total_supply, mintable)
        .await?;

    let token_address = result.token_address.to_string();
    state
        .index
        .set_cash_token(symbol, &token_address)
        .await;

    Ok(Json(CreateTokenResponse {
        token_address,
        tx_digest: result.tx_digest,
        name: name.to_string(),
        symbol: symbol.to_string(),
        creator: creator.to_string(),
    }))
}

async fn create_event_contract(
    State(state): State<AppState>,
    Json(body): Json<CreateEventContractRequest>,
) -> AppResult<Json<CreateEventContractResponse>> {
    let question = body.question.trim();
    if question.is_empty() {
        return Err(AppError::BadRequest("question is required".into()));
    }
    if body.resolution_deadline == 0 {
        return Err(AppError::BadRequest("resolution_deadline is required".into()));
    }

    let collateral_token = parse_token_contract(body.collateral_token.trim())
        .map_err(|e| AppError::BadRequest(format!("invalid collateral_token: {e}")))?;

    let signer = state
        .signer
        .dev_signer()
        .await
        .map_err(|e| AppError::Internal(format!("signer unavailable: {e}")))?;

    let creator = signer.address();
    let oracle = match body.oracle.as_deref() {
        Some(value) if !value.trim().is_empty() => Address::from_str(value.trim())
            .map_err(|e| AppError::BadRequest(format!("invalid oracle address: {e}")))?,
        _ => creator,
    };

    let tick_size = body.tick_size.unwrap_or(10_000);
    let min_order_size = body.min_order_size.unwrap_or(100_000);
    let maker_fee_bps = body.maker_fee_bps.unwrap_or(10);
    let taker_fee_bps = body.taker_fee_bps.unwrap_or(20);
    let allow_market_orders = body.allow_market_orders.unwrap_or(true);

    let result = state
        .chain
        .create_event_contract(
            &signer,
            question,
            collateral_token,
            oracle,
            body.resolution_deadline,
            tick_size,
            min_order_size,
            maker_fee_bps,
            taker_fee_bps,
            allow_market_orders,
        )
        .await?;

    state.index.register_question(question).await;

    let icon_url = normalize_icon_url(body.icon_url.as_deref());
    let market_address = result.market_address.to_string();
    let market = Market {
        id: market_uuid(&market_address),
        question: question.to_string(),
        icon_url: icon_url.clone(),
        market_address: market_address.clone(),
        collateral_token: result.collateral_token.to_string(),
        yes_token: result.yes_token.to_string(),
        no_token: result.no_token.to_string(),
        yes_spot_market: result.yes_spot_market.to_string(),
        no_spot_market: result.no_spot_market.to_string(),
        state: result.state.clone(),
        resolution_deadline: result.resolution_deadline,
    };

    state.index.upsert_market(market.clone()).await;

    Ok(Json(CreateEventContractResponse {
        market_id: market.id,
        question: question.to_string(),
        icon_url,
        market_address,
        collateral_token: market.collateral_token,
        yes_token: market.yes_token,
        no_token: market.no_token,
        yes_spot_market: market.yes_spot_market,
        no_spot_market: market.no_spot_market,
        state: market.state,
        resolution_deadline: market.resolution_deadline,
        tx_digest: result.tx_digest,
        creator: creator.to_string(),
    }))
}

fn normalize_icon_url(icon_url: Option<&str>) -> Option<String> {
    let value = icon_url?.trim();
    if value.is_empty() {
        return None;
    }
    if value.len() > 500_000 {
        return None;
    }
    Some(value.to_string())
}
