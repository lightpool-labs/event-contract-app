// Copyright (c) LightPool Labs
// Author: xiaoyu1998

use std::sync::Arc;

use dashmap::DashMap;
use lightpool_sdk::Signer;
use sqlx::PgPool;
use uuid::Uuid;

use crate::config::Config;
use crate::crypto_util::{decrypt_agent_secret, encrypt_agent_secret, normalize_address};
use crate::error::{AppError, AppResult};

#[derive(Clone, Debug)]
pub struct UserRecord {
    pub id: Uuid,
    pub lp_address: String,
    pub agent_address: String,
    pub agent_secret_encrypted: String,
    pub agent_authorized: bool,
}

#[derive(Clone)]
pub struct UserStore {
    pool: Option<PgPool>,
    memory: Arc<DashMap<String, UserRecord>>,
    encryption_key: String,
}

impl UserStore {
    pub async fn connect(config: &Config) -> Self {
        let db_url = config.database_url.trim();
        if db_url.is_empty() || db_url.eq_ignore_ascii_case("memory") {
            tracing::info!("DATABASE_URL unset/memory; using memory user store");
            return Self::memory_only(config);
        }

        match PgPool::connect(db_url).await {
            Ok(pool) => {
                if let Err(error) = sqlx::migrate!("./migrations").run(&pool).await {
                    tracing::warn!(%error, "database migrate failed; using memory user store");
                    return Self::memory_only(config);
                }
                tracing::info!("connected to postgres user store");
                Self {
                    pool: Some(pool),
                    memory: Arc::new(DashMap::new()),
                    encryption_key: config.agent_encryption_key.clone(),
                }
            }
            Err(error) => {
                tracing::warn!(%error, "database unavailable; using memory user store");
                Self::memory_only(config)
            }
        }
    }

    fn memory_only(config: &Config) -> Self {
        Self {
            pool: None,
            memory: Arc::new(DashMap::new()),
            encryption_key: config.agent_encryption_key.clone(),
        }
    }

    pub async fn get_or_create(&self, lp_address: &str) -> AppResult<UserRecord> {
        let lp_address = normalize_address(lp_address)?;
        if let Some(existing) = self.get(&lp_address).await? {
            return Ok(existing);
        }

        let agent = Signer::new();
        let agent_address = agent.address().to_string();
        let encrypted = encrypt_agent_secret(
            &agent.export_secret_key(),
            &self.encryption_key,
            &lp_address,
        );
        let record = UserRecord {
            id: Uuid::new_v4(),
            lp_address: lp_address.clone(),
            agent_address,
            agent_secret_encrypted: encrypted,
            agent_authorized: false,
        };

        if let Some(pool) = &self.pool {
            sqlx::query(
                r#"
                INSERT INTO users (id, lp_address, agent_address, agent_secret_encrypted, agent_authorized)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (lp_address) DO NOTHING
                "#,
            )
            .bind(record.id)
            .bind(&record.lp_address)
            .bind(&record.agent_address)
            .bind(&record.agent_secret_encrypted)
            .bind(record.agent_authorized)
            .execute(pool)
            .await
            .map_err(|e| AppError::Internal(format!("insert user: {e}")))?;
            return self
                .get(&lp_address)
                .await?
                .ok_or_else(|| AppError::Internal("user missing after insert".into()));
        }

        self.memory.insert(lp_address, record.clone());
        Ok(record)
    }

    pub async fn get(&self, lp_address: &str) -> AppResult<Option<UserRecord>> {
        let lp_address = normalize_address(lp_address)?;
        if let Some(pool) = &self.pool {
            let row = sqlx::query_as::<_, UserRow>(
                r#"
                SELECT id, lp_address, agent_address, agent_secret_encrypted, agent_authorized
                FROM users WHERE lower(lp_address) = lower($1)
                "#,
            )
            .bind(&lp_address)
            .fetch_optional(pool)
            .await
            .map_err(|e| AppError::Internal(format!("get user: {e}")))?;
            return Ok(row.map(UserRow::into_record));
        }
        Ok(self.memory.get(&lp_address).map(|r| r.clone()))
    }

    pub async fn mark_agent_authorized(&self, lp_address: &str) -> AppResult<()> {
        let lp_address = normalize_address(lp_address)?;
        if let Some(pool) = &self.pool {
            sqlx::query(
                r#"
                UPDATE users SET agent_authorized = TRUE
                WHERE lower(lp_address) = lower($1)
                "#,
            )
            .bind(&lp_address)
            .execute(pool)
            .await
            .map_err(|e| AppError::Internal(format!("mark agent authorized: {e}")))?;
            return Ok(());
        }
        if let Some(mut entry) = self.memory.get_mut(&lp_address) {
            entry.agent_authorized = true;
        }
        Ok(())
    }

    pub fn agent_signer(&self, user: &UserRecord) -> AppResult<Signer> {
        let secret = decrypt_agent_secret(
            &user.agent_secret_encrypted,
            &self.encryption_key,
            &user.lp_address,
        )?;
        Signer::from_secret_key_base64(&secret)
            .map_err(|e| AppError::Internal(format!("agent signer: {e}")))
    }
}

#[derive(sqlx::FromRow)]
struct UserRow {
    id: Uuid,
    lp_address: String,
    agent_address: String,
    agent_secret_encrypted: String,
    agent_authorized: bool,
}

impl UserRow {
    fn into_record(self) -> UserRecord {
        UserRecord {
            id: self.id,
            lp_address: self.lp_address,
            agent_address: self.agent_address,
            agent_secret_encrypted: self.agent_secret_encrypted,
            agent_authorized: self.agent_authorized,
        }
    }
}
