// Copyright (c) LightPool Labs
// Author: xiaoyu1998

use axum::{
    extract::{Path, Query, State},
    routing::get,
    Json, Router,
};

use crate::error::AppResult;
use crate::models::{QueryVaultsParams, Vault, VaultsPage};
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", get(query_vaults))
        .route("/:address", get(get_vault))
}

async fn query_vaults(
    State(state): State<AppState>,
    Query(params): Query<QueryVaultsParams>,
) -> AppResult<Json<VaultsPage>> {
    let page = state.clob.query_vaults(&params).await?;
    Ok(Json(page))
}

async fn get_vault(
    State(state): State<AppState>,
    Path(address): Path<String>,
) -> AppResult<Json<Vault>> {
    state.clob.get_vault_by_address(&address).await.map(Json)
}
