// Copyright (c) LightPool Labs
// Author: xiaoyu1998

use std::sync::Arc;

use axum::{
    async_trait,
    extract::FromRequestParts,
    http::request::Parts,
};
use chrono::{Duration, Utc};
use dashmap::DashMap;
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use rand::{distributions::Alphanumeric, Rng};
use serde::{Deserialize, Serialize};

use crate::crypto_util::{normalize_address, recover_personal_sign_address};
use crate::error::{AppError, AppResult};
use crate::state::AppState;

#[derive(Clone)]
pub struct AuthState {
    pub jwt_secret: String,
    nonces: Arc<DashMap<String, String>>,
}

impl AuthState {
    pub fn new(jwt_secret: String) -> Self {
        Self {
            jwt_secret,
            nonces: Arc::new(DashMap::new()),
        }
    }

    pub fn issue_nonce(&self, address: &str) -> AppResult<String> {
        let address = normalize_address(address)?;
        let nonce: String = rand::thread_rng()
            .sample_iter(&Alphanumeric)
            .take(24)
            .map(char::from)
            .collect();
        self.nonces.insert(address, nonce.clone());
        Ok(nonce)
    }

    pub fn login_message(address: &str, nonce: &str) -> String {
        format!(
            "LightPool Event App login\nAddress: {}\nNonce: {}",
            address, nonce
        )
    }

    pub fn verify_and_issue_token(
        &self,
        address: &str,
        signature: &str,
    ) -> AppResult<String> {
        let address = normalize_address(address)?;
        let nonce = self
            .nonces
            .remove(&address)
            .map(|(_, n)| n)
            .ok_or_else(|| AppError::Unauthorized("missing or expired nonce".into()))?;
        let message = Self::login_message(&address, &nonce);
        let recovered = recover_personal_sign_address(message.as_bytes(), signature)?;
        if recovered.to_string().eq_ignore_ascii_case(&address) {
            self.issue_jwt(&address)
        } else {
            Err(AppError::Unauthorized("signature does not match address".into()))
        }
    }

    pub fn issue_jwt(&self, address: &str) -> AppResult<String> {
        let claims = Claims {
            sub: address.to_string(),
            exp: (Utc::now() + Duration::hours(24)).timestamp() as usize,
        };
        encode(
            &Header::default(),
            &claims,
            &EncodingKey::from_secret(self.jwt_secret.as_bytes()),
        )
        .map_err(|e| AppError::Internal(format!("jwt encode: {e}")))
    }

    pub fn decode_jwt(&self, token: &str) -> AppResult<Claims> {
        decode::<Claims>(
            token,
            &DecodingKey::from_secret(self.jwt_secret.as_bytes()),
            &Validation::default(),
        )
        .map(|data| data.claims)
        .map_err(|e| AppError::Unauthorized(format!("invalid token: {e}")))
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Claims {
    pub sub: String,
    pub exp: usize,
}

#[derive(Clone, Debug)]
pub struct AuthUser {
    pub lp_address: String,
}

#[async_trait]
impl FromRequestParts<AppState> for AuthUser {
    type Rejection = AppError;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        let header = parts
            .headers
            .get(axum::http::header::AUTHORIZATION)
            .and_then(|v| v.to_str().ok())
            .ok_or_else(|| AppError::Unauthorized("missing Authorization header".into()))?;
        let token = header
            .strip_prefix("Bearer ")
            .or_else(|| header.strip_prefix("bearer "))
            .ok_or_else(|| AppError::Unauthorized("expected Bearer token".into()))?;
        let claims = state.auth.decode_jwt(token)?;
        Ok(AuthUser {
            lp_address: normalize_address(&claims.sub)?,
        })
    }
}
