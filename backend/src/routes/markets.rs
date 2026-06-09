use axum::{
    extract::{Path, Query, State},
    routing::{get, post},
    Json, Router,
};
use lightpool_sdk::parse_token_contract;
use serde::Deserialize;
use uuid::Uuid;

use crate::chain::{format_price_pieces, format_token_amount, parse_order_size};
use crate::error::{AppError, AppResult};
use crate::models::{BookLevel, BookResponse, Market, MintBurnRequest, MintBurnResponse};
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", get(list_markets))
        .route("/:id/book", get(get_book))
        .route("/:id/mint", post(mint_market))
        .route("/:id/burn", post(burn_market))
        .route("/:id", get(get_market))
}

#[derive(Debug, Deserialize)]
pub struct BookQuery {
    pub outcome: Option<String>,
    pub depth: Option<u32>,
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

async fn get_book(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Query(query): Query<BookQuery>,
) -> AppResult<Json<BookResponse>> {
    let outcome = query.outcome.as_deref().unwrap_or("yes");
    if outcome != "yes" && outcome != "no" {
        return Err(AppError::BadRequest("outcome must be yes or no".into()));
    }

    let market = state
        .index
        .get_market(id)
        .await
        .ok_or_else(|| AppError::NotFound(format!("market {id} not found")))?;

    let spot_market_str = if outcome == "yes" {
        &market.yes_spot_market
    } else {
        &market.no_spot_market
    };

    let spot_market = parse_token_contract(spot_market_str)
        .map_err(|e| AppError::BadRequest(format!("invalid spot market: {e}")))?;

    let account = state.signer.user_address().await;
    let depth = query.depth.unwrap_or(10);

    let book = state.chain.get_book(account, spot_market, depth).await?;
    let last_trade_price = if let Some(price) = state.index.last_trade_price(spot_market_str).await {
        Some(format_price_pieces(price))
    } else {
        let market_info = state.chain.get_market_info(account, spot_market).await?;
        market_info.last_price.map(|price| format_price_pieces(price))
    };

    Ok(Json(BookResponse {
        bids: book
            .best_bids
            .into_iter()
            .map(|level| BookLevel {
                price: format_price_pieces(level.price),
                size: format_token_amount(level.total_quantity),
            })
            .collect(),
        asks: book
            .best_asks
            .into_iter()
            .map(|level| BookLevel {
                price: format_price_pieces(level.price),
                size: format_token_amount(level.total_quantity),
            })
            .collect(),
        last_trade_price,
    }))
}

async fn mint_market(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(body): Json<MintBurnRequest>,
) -> AppResult<Json<MintBurnResponse>> {
    let market = state
        .index
        .get_market(id)
        .await
        .ok_or_else(|| AppError::NotFound(format!("market {id} not found")))?;

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
        market_id: id,
        amount: format_token_amount(result.amount),
        tx_digest: result.tx_digest,
    }))
}

async fn burn_market(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(body): Json<MintBurnRequest>,
) -> AppResult<Json<MintBurnResponse>> {
    let market = state
        .index
        .get_market(id)
        .await
        .ok_or_else(|| AppError::NotFound(format!("market {id} not found")))?;

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
        market_id: id,
        amount: format_token_amount(result.amount),
        tx_digest: result.tx_digest,
    }))
}
