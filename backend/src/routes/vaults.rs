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
use crate::models::{
    QueryVaultsParams, Vault, VaultDepositRequest, VaultDepositWithdrawResponse,
    VaultWithdrawRequest, VaultsPage,
};
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", get(query_vaults))
        .route("/:address/deposit", post(deposit_vault))
        .route("/:address/withdraw", post(withdraw_vault))
        .route("/:address", get(get_vault))
}

async fn query_vaults(
    State(state): State<AppState>,
    Query(mut params): Query<QueryVaultsParams>,
) -> AppResult<Json<VaultsPage>> {
    if params.account.is_none() {
        params.account = Some(state.signer.user_address().await.to_string());
    }
    let page = state.clob.query_vaults(&params).await?;
    Ok(Json(page))
}

async fn get_vault(
    State(state): State<AppState>,
    Path(address): Path<String>,
) -> AppResult<Json<Vault>> {
    let account = state.signer.user_address().await.to_string();
    state
        .clob
        .get_vault_by_address_for_account(&address, &account)
        .await
        .map(Json)
}

async fn deposit_vault(
    State(state): State<AppState>,
    Path(address): Path<String>,
    Json(body): Json<VaultDepositRequest>,
) -> AppResult<Json<VaultDepositWithdrawResponse>> {
    let vault = state.clob.get_vault_by_address(&address).await?;
    if vault.is_closed {
        return Err(AppError::BadRequest("vault is closed".into()));
    }
    if !vault.allow_deposit {
        return Err(AppError::BadRequest("vault deposits are disabled".into()));
    }

    let amount = parse_order_size(&body.amount)?;
    let vault_address = parse_token_contract(&vault.vault_address)
        .map_err(|e| AppError::BadRequest(format!("invalid vault address: {e}")))?;
    let quote_token = parse_token_contract(&vault.quote_token)
        .map_err(|e| AppError::BadRequest(format!("invalid quote token: {e}")))?;
    let share_token = parse_token_contract(&vault.share_token)
        .map_err(|e| AppError::BadRequest(format!("invalid share token: {e}")))?;

    let signer = state
        .signer
        .dev_signer()
        .await
        .map_err(|e| AppError::Internal(format!("signer unavailable: {e}")))?;

    let result = state
        .chain
        .deposit_vault(&signer, vault_address, quote_token, share_token, amount)
        .await?;

    Ok(Json(VaultDepositWithdrawResponse {
        vault_address: vault.vault_address,
        amount: format_token_amount(result.amount),
        shares: format_token_amount(result.shares),
        tx_digest: result.tx_digest,
    }))
}

async fn withdraw_vault(
    State(state): State<AppState>,
    Path(address): Path<String>,
    Json(body): Json<VaultWithdrawRequest>,
) -> AppResult<Json<VaultDepositWithdrawResponse>> {
    let vault = state.clob.get_vault_by_address(&address).await?;
    if vault.is_closed {
        return Err(AppError::BadRequest("vault is closed".into()));
    }

    let shares = parse_order_size(&body.shares)?;
    let vault_address = parse_token_contract(&vault.vault_address)
        .map_err(|e| AppError::BadRequest(format!("invalid vault address: {e}")))?;
    let quote_token = parse_token_contract(&vault.quote_token)
        .map_err(|e| AppError::BadRequest(format!("invalid quote token: {e}")))?;
    let share_token = parse_token_contract(&vault.share_token)
        .map_err(|e| AppError::BadRequest(format!("invalid share token: {e}")))?;

    let signer = state
        .signer
        .dev_signer()
        .await
        .map_err(|e| AppError::Internal(format!("signer unavailable: {e}")))?;

    let result = state
        .chain
        .withdraw_vault(&signer, vault_address, quote_token, share_token, shares)
        .await?;

    Ok(Json(VaultDepositWithdrawResponse {
        vault_address: vault.vault_address,
        amount: format_token_amount(result.amount),
        shares: format_token_amount(result.shares),
        tx_digest: result.tx_digest,
    }))
}
