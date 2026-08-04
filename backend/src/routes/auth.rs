// Copyright (c) LightPool Labs
// Author: xiaoyu1998

use axum::{extract::State, routing::post, Json, Router};
use serde::{Deserialize, Serialize};

use crate::auth::AuthState;
use crate::crypto_util::normalize_address;
use crate::error::AppResult;
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/nonce", post(nonce))
        .route("/verify", post(verify))
}

#[derive(Deserialize)]
pub struct NonceRequest {
    pub address: String,
}

#[derive(Serialize)]
pub struct NonceResponse {
    pub address: String,
    pub nonce: String,
    pub message: String,
}

#[derive(Deserialize)]
pub struct VerifyRequest {
    pub address: String,
    pub signature: String,
}

#[derive(Serialize)]
pub struct VerifyResponse {
    pub token: String,
    pub address: String,
    pub agent_address: String,
    pub agent_authorized: bool,
}

async fn nonce(
    State(state): State<AppState>,
    Json(body): Json<NonceRequest>,
) -> AppResult<Json<NonceResponse>> {
    let address = normalize_address(&body.address)?;
    let nonce = state.auth.issue_nonce(&address)?;
    let message = AuthState::login_message(&address, &nonce);
    Ok(Json(NonceResponse {
        address,
        nonce,
        message,
    }))
}

async fn verify(
    State(state): State<AppState>,
    Json(body): Json<VerifyRequest>,
) -> AppResult<Json<VerifyResponse>> {
    let address = normalize_address(&body.address)?;
    let token = state.auth.verify_and_issue_token(&address, &body.signature)?;
    let user = state.users.get_or_create(&address).await?;
    Ok(Json(VerifyResponse {
        token,
        address: user.lp_address,
        agent_address: user.agent_address,
        agent_authorized: user.agent_authorized,
    }))
}
