pub mod account;
pub mod admin;
pub mod events;
pub mod health;
pub mod orders;

use axum::Router;

use crate::state::AppState;

pub fn api_router() -> Router<AppState> {
    Router::new()
        .nest("/health", health::router())
        .nest("/events", events::router())
        .nest("/orders", orders::router())
        .nest("/account", account::router())
        .nest("/admin", admin::router())
}
