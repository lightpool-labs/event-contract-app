use axum::{
    extract::{Path, Query, State},
    routing::{get, post},
    Json, Router,
};
use lightpool_sdk::parse_token_contract;
use serde::Deserialize;

use crate::chain::{format_token_amount, parse_order_size};
use crate::error::{AppError, AppResult};
use crate::models::{BookResponse, Market, MintBurnRequest, MintBurnResponse};
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", get(list_events))
        .route("/:slug/book", get(get_book))
        .route("/:slug/mint", post(mint_event))
        .route("/:slug/burn", post(burn_event))
        .route("/:slug", get(get_event))
}

#[derive(Debug, Deserialize)]
pub struct BookQuery {
    pub outcome: Option<String>,
    pub depth: Option<u32>,
}

async fn resolve_event(state: &AppState, slug: &str) -> AppResult<Market> {
    state
        .clob
        .get_market_by_slug(slug)
        .await
}

async fn list_events(State(state): State<AppState>) -> AppResult<Json<Vec<Market>>> {
    let markets = state.clob.list_markets().await?;
    Ok(Json(markets))
}

async fn get_event(
    State(state): State<AppState>,
    Path(slug): Path<String>,
) -> AppResult<Json<Market>> {
    resolve_event(&state, &slug).await.map(Json)
}

async fn get_book(
    State(state): State<AppState>,
    Path(slug): Path<String>,
    Query(query): Query<BookQuery>,
) -> AppResult<Json<BookResponse>> {
    let outcome = query.outcome.as_deref().unwrap_or("yes");
    if outcome != "yes" && outcome != "no" {
        return Err(AppError::BadRequest("outcome must be yes or no".into()));
    }

    let market = resolve_event(&state, &slug).await?;

    let spot_market_str = if outcome == "yes" {
        &market.yes_spot_market
    } else {
        &market.no_spot_market
    };

    let account = state.signer.user_address().await.to_string();
    let depth = query.depth.unwrap_or(10);

    let book = state
        .clob
        .get_book(&account, spot_market_str, depth)
        .await?;

    Ok(Json(book))
}

async fn mint_event(
    State(state): State<AppState>,
    Path(slug): Path<String>,
    Json(body): Json<MintBurnRequest>,
) -> AppResult<Json<MintBurnResponse>> {
    let market = resolve_event(&state, &slug).await?;

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

async fn burn_event(
    State(state): State<AppState>,
    Path(slug): Path<String>,
    Json(body): Json<MintBurnRequest>,
) -> AppResult<Json<MintBurnResponse>> {
    let market = resolve_event(&state, &slug).await?;

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
