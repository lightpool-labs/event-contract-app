// Copyright (c) LightPool Labs
// Author: xiaoyu1998

pub mod account;
pub mod admin;
pub mod markets;
pub mod health;
pub mod orders;
pub mod vaults;

use axum::Router;

use crate::state::AppState;

pub fn api_router() -> Router<AppState> {
    Router::new()
        .nest("/health", health::router())
        .nest("/markets", markets::router())
        .nest("/vaults", vaults::router())
        .nest("/orders", orders::router())
        .nest("/account", account::router())
        .nest("/admin", admin::router())
}
