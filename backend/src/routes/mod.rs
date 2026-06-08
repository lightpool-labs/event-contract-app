pub mod account;
pub mod health;
pub mod markets;
pub mod orders;

use axum::Router;

use crate::state::AppState;

pub fn api_router() -> Router<AppState> {
    Router::new()
        .nest("/health", health::router())
        .nest("/markets", markets::router())
        .nest("/orders", orders::router())
        .nest("/account", account::router())
}
