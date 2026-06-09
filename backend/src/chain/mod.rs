use async_trait::async_trait;
use lightpool_sdk::lightpool_types::call::{GetBalance, GetBalanceParams};
use lightpool_sdk::lightpool_types::SignedTransaction;
use lightpool_sdk::types::SubmitTransactionResponse;
use lightpool_sdk::{
    extract_event_contract_created_from_events, extract_token_address_from_events, ActionBuilder,
    Address, ContractAddress, CreateEventContractParams, CreateTokenParams, LightPoolClient,
    SdkResult, Signer, TransactionBuilder, TOKEN_SCALE,
};
use std::sync::Arc;

use crate::error::{AppError, AppResult};

pub struct CreateTokenResult {
    pub token_address: ContractAddress,
    pub tx_digest: String,
}

pub struct CreateEventContractResult {
    pub market_address: ContractAddress,
    pub collateral_token: ContractAddress,
    pub yes_token: ContractAddress,
    pub no_token: ContractAddress,
    pub yes_spot_market: ContractAddress,
    pub no_spot_market: ContractAddress,
    pub resolution_deadline: u64,
    pub state: String,
    pub tx_digest: String,
}

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

    pub async fn submit_transaction(&self, tx: SignedTransaction) -> AppResult<SubmitTransactionResponse> {
        self.client
            .submit_transaction(tx)
            .await
            .map_err(|e| AppError::Internal(format!("submit transaction failed: {e}")))
    }

    pub async fn create_token(
        &self,
        signer: &Signer,
        name: &str,
        symbol: &str,
        total_supply_whole: u64,
        mintable: bool,
    ) -> AppResult<CreateTokenResult> {
        let sender = signer.address();
        let params = CreateTokenParams {
            name: name.into(),
            symbol: symbol.into(),
            total_supply: total_supply_whole
                .checked_mul(TOKEN_SCALE)
                .ok_or_else(|| AppError::BadRequest("total_supply overflow".into()))?,
            mintable,
            to: sender,
        };

        let action = ActionBuilder::create_token(params)
            .map_err(|e| AppError::Internal(format!("build create_token action: {e}")))?;

        let tx = TransactionBuilder::new()
            .sender(sender)
            .expiration(u64::MAX)
            .add_action(action)
            .build_and_sign_only(signer)
            .map_err(|e| AppError::Internal(format!("sign create_token tx: {e}")))?;

        let response = self.submit_transaction(tx).await?;

        if !response.receipt.is_success() {
            return Err(AppError::Internal(format!(
                "create_token failed: {:?}",
                response.receipt.status
            )));
        }

        let token_address = extract_token_address_from_events(&response.receipt).ok_or_else(|| {
            AppError::Internal("token address missing from create_token receipt".into())
        })?;

        Ok(CreateTokenResult {
            token_address,
            tx_digest: response.digest,
        })
    }

    pub async fn create_event_contract(
        &self,
        signer: &Signer,
        question: &str,
        collateral_token: ContractAddress,
        oracle: Address,
        resolution_deadline: u64,
        tick_size: u64,
        min_order_size: u64,
        maker_fee_bps: u16,
        taker_fee_bps: u16,
        allow_market_orders: bool,
    ) -> AppResult<CreateEventContractResult> {
        let sender = signer.address();
        let params = CreateEventContractParams {
            question_hash: question_hash(question),
            oracle,
            collateral_token,
            resolution_deadline,
            tick_size,
            min_order_size,
            maker_fee_bps,
            taker_fee_bps,
            allow_market_orders,
            neg_risk_group_id: None,
        };

        let action = ActionBuilder::create_event_contract(params)
            .map_err(|e| AppError::Internal(format!("build create_event_contract action: {e}")))?;

        let tx = TransactionBuilder::new()
            .sender(sender)
            .expiration(u64::MAX)
            .add_action(action)
            .build_and_sign_only(signer)
            .map_err(|e| AppError::Internal(format!("sign create_event_contract tx: {e}")))?;

        let response = self.submit_transaction(tx).await?;

        if !response.receipt.is_success() {
            return Err(AppError::Internal(format!(
                "create_event_contract failed: {:?}",
                response.receipt.status
            )));
        }

        let created = extract_event_contract_created_from_events(&response.receipt).ok_or_else(|| {
            AppError::Internal(
                "event contract created event missing from receipt".into(),
            )
        })?;

        Ok(CreateEventContractResult {
            market_address: created.market_address,
            collateral_token: created.collateral_token,
            yes_token: created.yes_token,
            no_token: created.no_token,
            yes_spot_market: created.yes_spot_market,
            no_spot_market: created.no_spot_market,
            resolution_deadline: created.resolution_deadline,
            state: created.state.to_string(),
            tx_digest: response.digest,
        })
    }

    pub async fn get_balance(
        &self,
        account: Address,
        token_contract: ContractAddress,
    ) -> AppResult<GetBalance> {
        let action = ActionBuilder::get_balance(token_contract, account, GetBalanceParams {})
            .map_err(|e| AppError::Internal(format!("build get_balance action: {e}")))?;

        let call_tx = TransactionBuilder::new()
            .account(account)
            .expiration(u64::MAX)
            .add_action(action)
            .build_and_without_sign()
            .map_err(|e| AppError::Internal(format!("build get_balance call tx: {e}")))?;

        let bytes = self
            .client
            .call(call_tx)
            .await
            .map_err(|e| AppError::Internal(format!("call get_balance failed: {e}")))?;

        bincode::deserialize(&bytes)
            .map_err(|e| AppError::Internal(format!("decode GetBalance: {e}")))
    }
}

pub fn format_token_amount(raw: u64) -> String {
    let whole = raw / TOKEN_SCALE;
    let frac = raw % TOKEN_SCALE;
    if frac == 0 {
        return whole.to_string();
    }
    format!("{whole}.{frac:06}", frac = frac)
}

fn question_hash(question: &str) -> [u8; 32] {
    compute_question_hash(question)
}

pub fn compute_question_hash(question: &str) -> [u8; 32] {
    let mut hash = [0u8; 32];
    let bytes = question.as_bytes();
    let len = bytes.len().min(32);
    hash[..len].copy_from_slice(&bytes[..len]);
    hash
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
