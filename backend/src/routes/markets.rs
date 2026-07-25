// Copyright (c) LightPool Labs
// Author: xiaoyu1998

use axum::{
    extract::{Path, Query, State},
    routing::{get, post},
    Json, Router,
};
use lightpool_sdk::parse_token_contract;

use crate::chain::{format_token_amount, parse_order_size};
use crate::error::{AppError, AppResult};
use crate::models::{Market, MarketsPage, MintBurnRequest, MintBurnResponse, QueryMarketsParams};
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", get(query_markets))
        .route("/:slug/mint", post(mint_market))
        .route("/:slug/burn", post(burn_market))
        .route("/:slug", get(get_market))
}

async fn resolve_market(state: &AppState, slug: &str) -> AppResult<Market> {
    state.clob.get_market_by_slug(slug).await
}

async fn query_markets(
    State(state): State<AppState>,
    Query(params): Query<QueryMarketsParams>,
) -> AppResult<Json<MarketsPage>> {
    let page = state.clob.query_markets(&params).await?;
    Ok(Json(page))
}

async fn get_market(
    State(state): State<AppState>,
    Path(slug): Path<String>,
) -> AppResult<Json<Market>> {
    resolve_market(&state, &slug).await.map(Json)
}

async fn mint_market(
    State(state): State<AppState>,
    Path(slug): Path<String>,
    Json(body): Json<MintBurnRequest>,
) -> AppResult<Json<MintBurnResponse>> {
    let market = resolve_market(&state, &slug).await?;

    let amount = parse_order_size(&body.amount)?;
    let market_address = parse_token_contract(&market.market_address)
        .map_err(|e| AppError::BadRequest(format!("invalid market address: {e}")))?;
    let collateral_token = parse_token_contract(&market.collateral_token)
        .map_err(|e| AppError::BadRequest(format!("invalid collateral token: {e}")))?;
    let yes_token = parse_token_contract(&market.yes_token)
        .map_err(|e| AppError::BadRequest(format!("invalid yes token: {e}")))?;
    let no_token = parse_token_contract(&market.no_token)
        .map_err(|e| AppError::BadRequest(format!("invalid no token: {e}")))?;

    let signer = state
        .signer
        .dev_signer()
        .await
        .map_err(|e| AppError::Internal(format!("signer unavailable: {e}")))?;

    let result = state
        .chain
        .mint_event_contract(
            &signer,
            market_address,
            collateral_token,
            yes_token,
            no_token,
            amount,
        )
        .await?;

    Ok(Json(MintBurnResponse {
        slug: market.slug,
        amount: format_token_amount(result.amount),
        tx_digest: result.tx_digest,
    }))
}

async fn burn_market(
    State(state): State<AppState>,
    Path(slug): Path<String>,
    Json(body): Json<MintBurnRequest>,
) -> AppResult<Json<MintBurnResponse>> {
    let market = resolve_market(&state, &slug).await?;

    let amount = parse_order_size(&body.amount)?;
    let market_address = parse_token_contract(&market.market_address)
        .map_err(|e| AppError::BadRequest(format!("invalid market address: {e}")))?;
    let collateral_token = parse_token_contract(&market.collateral_token)
        .map_err(|e| AppError::BadRequest(format!("invalid collateral token: {e}")))?;
    let yes_token = parse_token_contract(&market.yes_token)
        .map_err(|e| AppError::BadRequest(format!("invalid yes token: {e}")))?;
    let no_token = parse_token_contract(&market.no_token)
        .map_err(|e| AppError::BadRequest(format!("invalid no token: {e}")))?;

    let signer = state
        .signer
        .dev_signer()
        .await
        .map_err(|e| AppError::Internal(format!("signer unavailable: {e}")))?;

    let result = state
        .chain
        .burn_event_contract(
            &signer,
            market_address,
            collateral_token,
            yes_token,
            no_token,
            amount,
        )
        .await?;

    Ok(Json(MintBurnResponse {
        slug: market.slug,
        amount: format_token_amount(result.amount),
        tx_digest: result.tx_digest,
    }))
}
