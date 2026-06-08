use async_trait::async_trait;
use lightpool_sdk::lightpool_types::SignedTransaction;
use lightpool_sdk::{Address, LightPoolClient, SdkResult, Signer};
use std::sync::Arc;

use crate::error::{AppError, AppResult};

pub struct ChainClient {
    client: LightPoolClient,
}

impl ChainClient {
    pub fn new(rpc_url: &str) -> Self {
        Self {
            client: LightPoolClient::new(rpc_url),
        }
    }

    pub fn client(&self) -> &LightPoolClient {
        &self.client
    }

    pub async fn health_check(&self) -> AppResult<bool> {
        self.client
            .health_check()
            .await
            .map_err(|e| AppError::Internal(format!("node health check failed: {e}")))
    }

    pub async fn submit_transaction(&self, tx: SignedTransaction) -> AppResult<()> {
        self.client
            .submit_transaction(tx)
            .await
            .map_err(|e| AppError::Internal(format!("submit transaction failed: {e}")))?;
        Ok(())
    }
}

/// Signing abstraction — swap implementation when wallet integration lands.
#[async_trait]
pub trait SignerService: Send + Sync {
    async fn dev_signer(&self) -> SdkResult<Signer>;
    async fn user_address(&self) -> Address;
}

pub struct LocalSignerService {
    secret_key_b64: String,
    address: Address,
}

impl LocalSignerService {
    pub fn new() -> Self {
        let signer = Signer::new();
        Self {
            secret_key_b64: signer.export_secret_key(),
            address: signer.address(),
        }
    }
}

#[async_trait]
impl SignerService for LocalSignerService {
    async fn dev_signer(&self) -> SdkResult<Signer> {
        Signer::from_secret_key_base64(&self.secret_key_b64)
    }

    async fn user_address(&self) -> Address {
        self.address
    }
}

pub type SharedChainClient = Arc<ChainClient>;
pub type SharedSignerService = Arc<dyn SignerService>;
