// Copyright (c) LightPool Labs
// Author: xiaoyu1998

use std::sync::Arc;

use dashmap::DashMap;
use sqlx::PgPool;

use crate::config::Config;
use crate::error::{AppError, AppResult};

#[derive(Clone, Debug, Default)]
pub struct MarketMetadata {
    pub market_address: String,
    pub slug: String,
    pub event_slug: Option<String>,
    pub group_item_title: Option<String>,
    pub icon_url: Option<String>,
}

#[derive(Clone, Debug, Default)]
pub struct MarketMetadataPatch {
    pub event_slug: Option<Option<String>>,
    pub group_item_title: Option<Option<String>>,
    pub icon_url: Option<Option<String>>,
}

#[derive(Clone)]
pub struct MarketMetadataStore {
    pool: Option<PgPool>,
    memory: Arc<DashMap<String, MarketMetadata>>,
}

impl MarketMetadataStore {
    pub async fn connect(config: &Config) -> Self {
        let db_url = config.database_url.trim();
        if db_url.is_empty() || db_url.eq_ignore_ascii_case("memory") {
            tracing::info!("DATABASE_URL unset/memory; using memory market metadata store");
            return Self::memory_only();
        }

        match PgPool::connect(db_url).await {
            Ok(pool) => {
                if let Err(error) = sqlx::migrate!("./migrations").run(&pool).await {
                    tracing::warn!(%error, "database migrate failed; using memory market metadata store");
                    return Self::memory_only();
                }
                tracing::info!("connected to postgres market metadata store");
                Self {
                    pool: Some(pool),
                    memory: Arc::new(DashMap::new()),
                }
            }
            Err(error) => {
                tracing::warn!(%error, "database unavailable; using memory market metadata store");
                Self::memory_only()
            }
        }
    }

    fn memory_only() -> Self {
        Self {
            pool: None,
            memory: Arc::new(DashMap::new()),
        }
    }

    pub async fn get_by_market_address(&self, market_address: &str) -> AppResult<Option<MarketMetadata>> {
        let key = normalize_key(market_address);
        if key.is_empty() {
            return Ok(None);
        }

        if let Some(pool) = &self.pool {
            let row = sqlx::query_as::<_, MetadataRow>(
                r#"
                SELECT market_address, slug, event_slug, group_item_title, icon_url
                FROM market_metadata
                WHERE lower(market_address) = lower($1)
                "#,
            )
            .bind(&key)
            .fetch_optional(pool)
            .await
            .map_err(|e| AppError::Internal(format!("get market metadata: {e}")))?;
            return Ok(row.map(MetadataRow::into_record));
        }

        Ok(self.memory.get(&key).map(|entry| entry.clone()))
    }

    pub async fn get_by_slug(&self, slug: &str) -> AppResult<Option<MarketMetadata>> {
        let slug = slug.trim();
        if slug.is_empty() {
            return Ok(None);
        }

        if let Some(pool) = &self.pool {
            let row = sqlx::query_as::<_, MetadataRow>(
                r#"
                SELECT market_address, slug, event_slug, group_item_title, icon_url
                FROM market_metadata
                WHERE lower(slug) = lower($1)
                "#,
            )
            .bind(slug)
            .fetch_optional(pool)
            .await
            .map_err(|e| AppError::Internal(format!("get market metadata by slug: {e}")))?;
            return Ok(row.map(MetadataRow::into_record));
        }

        Ok(self
            .memory
            .iter()
            .find(|entry| entry.slug.eq_ignore_ascii_case(slug))
            .map(|entry| entry.clone()))
    }

    pub async fn get_many_by_market_addresses(
        &self,
        market_addresses: &[String],
    ) -> AppResult<Vec<MarketMetadata>> {
        if market_addresses.is_empty() {
            return Ok(Vec::new());
        }

        if let Some(pool) = &self.pool {
            let keys: Vec<String> = market_addresses
                .iter()
                .map(|value| normalize_key(value))
                .filter(|value| !value.is_empty())
                .collect();
            if keys.is_empty() {
                return Ok(Vec::new());
            }

            let rows = sqlx::query_as::<_, MetadataRow>(
                r#"
                SELECT market_address, slug, event_slug, group_item_title, icon_url
                FROM market_metadata
                WHERE lower(market_address) = ANY($1)
                "#,
            )
            .bind(
                keys.iter()
                    .map(|value| value.to_lowercase())
                    .collect::<Vec<_>>(),
            )
            .fetch_all(pool)
            .await
            .map_err(|e| AppError::Internal(format!("list market metadata: {e}")))?;
            return Ok(rows.into_iter().map(MetadataRow::into_record).collect());
        }

        let mut out = Vec::new();
        for address in market_addresses {
            let key = normalize_key(address);
            if let Some(entry) = self.memory.get(&key) {
                out.push(entry.clone());
            }
        }
        Ok(out)
    }

    pub async fn upsert(&self, metadata: MarketMetadata) -> AppResult<MarketMetadata> {
        let mut metadata = metadata;
        metadata.market_address = normalize_key(&metadata.market_address);
        metadata.slug = metadata.slug.trim().to_string();
        metadata.event_slug = normalize_optional(metadata.event_slug);
        metadata.group_item_title = normalize_optional(metadata.group_item_title);
        metadata.icon_url = normalize_optional(metadata.icon_url);

        if metadata.market_address.is_empty() {
            return Err(AppError::BadRequest("market_address is required".into()));
        }
        if metadata.slug.is_empty() {
            return Err(AppError::BadRequest("slug is required".into()));
        }

        if let Some(pool) = &self.pool {
            sqlx::query(
                r#"
                INSERT INTO market_metadata (
                    market_address, slug, event_slug, group_item_title, icon_url, updated_at
                )
                VALUES ($1, $2, $3, $4, $5, now())
                ON CONFLICT (market_address) DO UPDATE SET
                    slug = EXCLUDED.slug,
                    event_slug = EXCLUDED.event_slug,
                    group_item_title = EXCLUDED.group_item_title,
                    icon_url = EXCLUDED.icon_url,
                    updated_at = now()
                "#,
            )
            .bind(&metadata.market_address)
            .bind(&metadata.slug)
            .bind(&metadata.event_slug)
            .bind(&metadata.group_item_title)
            .bind(&metadata.icon_url)
            .execute(pool)
            .await
            .map_err(|e| AppError::Internal(format!("upsert market metadata: {e}")))?;
            return Ok(metadata);
        }

        self.memory
            .insert(metadata.market_address.clone(), metadata.clone());
        Ok(metadata)
    }

    pub async fn patch_by_slug(
        &self,
        slug: &str,
        market_address: &str,
        patch: MarketMetadataPatch,
    ) -> AppResult<MarketMetadata> {
        let existing = self
            .get_by_slug(slug)
            .await?
            .or(self.get_by_market_address(market_address).await?);

        let mut next = existing.unwrap_or(MarketMetadata {
            market_address: normalize_key(market_address),
            slug: slug.trim().to_string(),
            ..MarketMetadata::default()
        });
        next.market_address = normalize_key(market_address);
        next.slug = slug.trim().to_string();

        if let Some(event_slug) = patch.event_slug {
            next.event_slug = normalize_optional(event_slug);
        }
        if let Some(group_item_title) = patch.group_item_title {
            next.group_item_title = normalize_optional(group_item_title);
        }
        if let Some(icon_url) = patch.icon_url {
            next.icon_url = normalize_optional(icon_url);
        }

        self.upsert(next).await
    }
}

fn normalize_key(value: &str) -> String {
    value.trim().to_string()
}

fn normalize_optional(value: Option<String>) -> Option<String> {
    value.and_then(|raw| {
        let trimmed = raw.trim();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed.to_string())
        }
    })
}

#[derive(sqlx::FromRow)]
struct MetadataRow {
    market_address: String,
    slug: String,
    event_slug: Option<String>,
    group_item_title: Option<String>,
    icon_url: Option<String>,
}

impl MetadataRow {
    fn into_record(self) -> MarketMetadata {
        MarketMetadata {
            market_address: self.market_address,
            slug: self.slug,
            event_slug: self.event_slug,
            group_item_title: self.group_item_title,
            icon_url: self.icon_url,
        }
    }
}
