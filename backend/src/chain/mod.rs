use async_trait::async_trait;
use lightpool_sdk::spot_events::OrderCreatedEvent;
use lightpool_sdk::types::SubmitTransactionResponse;
use lightpool_sdk::{
    extract_event_contract_created_from_events, extract_token_address_from_events, ActionBuilder,
    Address, BurnEventContractParams, ContractAddress, CreateEventContractParams, CreateTokenParams,
    EventData, EventType, CancelOrderParams, MintEventContractParams,
    PlaceOrderParams, SdkError, SdkResult, Signer,
    TransactionBuilder, TOKEN_SCALE,
};
use std::sync::Arc;
use uuid::Uuid;

use crate::clob::ClobIndexClient;
use crate::config::Config;
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

pub struct MintBurnResult {
    pub tx_digest: String,
    pub amount: u64,
}

pub struct ChainClient {
    clob: Arc<ClobIndexClient>,
}

impl ChainClient {
    pub fn new(clob: Arc<ClobIndexClient>) -> Self {
        Self { clob }
    }

    pub async fn submit_transaction(
        &self,
        tx: lightpool_sdk::lightpool_types::SignedTransaction,
    ) -> AppResult<SubmitTransactionResponse> {
        self.clob.submit_transaction(tx).await
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

    pub async fn mint_event_contract(
        &self,
        signer: &Signer,
        market_address: ContractAddress,
        collateral_token: ContractAddress,
        yes_token: ContractAddress,
        no_token: ContractAddress,
        amount: u64,
    ) -> AppResult<MintBurnResult> {
        let sender = signer.address();
        let params = MintEventContractParams {
            amount,
            collateral_token,
            yes_token,
            no_token,
        };

        let action = ActionBuilder::mint_event_contract(market_address, params)
            .map_err(|e| AppError::Internal(format!("build mint_event_contract action: {e}")))?;

        let tx = TransactionBuilder::new()
            .sender(sender)
            .expiration(u64::MAX)
            .add_action(action)
            .build_and_sign_only(signer)
            .map_err(|e| AppError::Internal(format!("sign mint_event_contract tx: {e}")))?;

        let response = self.submit_transaction(tx).await?;

        if !response.receipt.is_success() {
            return Err(AppError::Internal(format!(
                "mint_event_contract failed: {:?}",
                response.receipt.status
            )));
        }

        Ok(MintBurnResult {
            tx_digest: response.digest,
            amount,
        })
    }

    pub async fn burn_event_contract(
        &self,
        signer: &Signer,
        market_address: ContractAddress,
        collateral_token: ContractAddress,
        yes_token: ContractAddress,
        no_token: ContractAddress,
        amount: u64,
    ) -> AppResult<MintBurnResult> {
        let sender = signer.address();
        let params = BurnEventContractParams {
            amount,
            collateral_token,
            yes_token,
            no_token,
        };

        let action = ActionBuilder::burn_event_contract(market_address, params)
            .map_err(|e| AppError::Internal(format!("build burn_event_contract action: {e}")))?;

        let tx = TransactionBuilder::new()
            .sender(sender)
            .expiration(u64::MAX)
            .add_action(action)
            .build_and_sign_only(signer)
            .map_err(|e| AppError::Internal(format!("sign burn_event_contract tx: {e}")))?;

        let response = self.submit_transaction(tx).await?;

        if !response.receipt.is_success() {
            return Err(AppError::Internal(format!(
                "burn_event_contract failed: {:?}",
                response.receipt.status
            )));
        }

        Ok(MintBurnResult {
            tx_digest: response.digest,
            amount,
        })
    }

    pub async fn place_order(
        &self,
        signer: &Signer,
        spot_market: ContractAddress,
        params: PlaceOrderParams,
    ) -> AppResult<SubmitTransactionResponse> {
        let sender = signer.address();

        let action = ActionBuilder::place_order(spot_market, params)
            .map_err(|e| AppError::Internal(format!("build place_order action: {e}")))?;

        let tx = TransactionBuilder::new()
            .sender(sender)
            .expiration(u64::MAX)
            .add_action(action)
            .build_and_sign_only(signer)
            .map_err(|e| AppError::Internal(format!("sign place_order tx: {e}")))?;

        let response = self.submit_transaction(tx).await?;

        if !response.receipt.is_success() {
            return Err(AppError::Internal(format!(
                "place_order failed: {:?}",
                response.receipt.status
            )));
        }

        Ok(response)
    }

    pub async fn cancel_order(
        &self,
        signer: &Signer,
        spot_market: ContractAddress,
        order_id: u64,
    ) -> AppResult<SubmitTransactionResponse> {
        let sender = signer.address();
        let params = CancelOrderParams { order_id };

        let action = ActionBuilder::cancel_order(spot_market, params)
            .map_err(|e| AppError::Internal(format!("build cancel_order action: {e}")))?;

        let tx = TransactionBuilder::new()
            .sender(sender)
            .expiration(u64::MAX)
            .add_action(action)
            .build_and_sign_only(signer)
            .map_err(|e| AppError::Internal(format!("sign cancel_order tx: {e}")))?;

        let response = self.submit_transaction(tx).await?;

        if !response.receipt.is_success() {
            return Err(AppError::Internal(format!(
                "cancel_order failed: {:?}",
                response.receipt.status
            )));
        }

        Ok(response)
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

pub fn format_price_pieces(raw: u64) -> String {
    ((raw.saturating_mul(100)) / TOKEN_SCALE).to_string()
}

pub fn parse_price_pieces(price: &str) -> AppResult<u64> {
    let pieces: u64 = price
        .trim()
        .parse()
        .map_err(|e| AppError::BadRequest(format!("invalid price: {e}")))?;
    if pieces > 100 {
        return Err(AppError::BadRequest("price must be between 0 and 100".into()));
    }
    Ok((pieces * TOKEN_SCALE) / 100)
}

pub fn parse_order_size(size: &str) -> AppResult<u64> {
    let value: f64 = size
        .trim()
        .parse()
        .map_err(|e| AppError::BadRequest(format!("invalid size: {e}")))?;
    if value <= 0.0 {
        return Err(AppError::BadRequest("size must be greater than 0".into()));
    }
    let raw = (value * TOKEN_SCALE as f64).round() as u64;
    if raw == 0 {
        return Err(AppError::BadRequest("size must be greater than 0".into()));
    }
    Ok(raw)
}

pub fn extract_order_created_from_receipt(
    receipt: &lightpool_sdk::TransactionReceipt,
) -> Option<OrderCreatedEvent> {
    for event in &receipt.events {
        let EventType::Call(action_name) = &event.event_type else {
            continue;
        };
        if action_name.as_str() != "order_created" {
            continue;
        }
        let EventData::Bytes(data) = &event.data else {
            continue;
        };
        if let Ok(created) = bincode::deserialize::<OrderCreatedEvent>(data) {
            return Some(created);
        }
    }
    None
}

fn question_hash(question: &str) -> [u8; 32] {
    compute_question_hash(question)
}

pub fn market_uuid(market_address: &str) -> Uuid {
    Uuid::new_v5(&Uuid::NAMESPACE_OID, market_address.as_bytes())
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

fn load_signer_from_dev_secret_key(raw: &str) -> SdkResult<Signer> {
    let trimmed = raw.trim();
    let hex_body = trimmed
        .strip_prefix("0x")
        .or_else(|| trimmed.strip_prefix("0X"))
        .unwrap_or(trimmed);

    let is_hex = !hex_body.is_empty()
        && hex_body.len() == 64
        && hex_body.chars().all(|c| c.is_ascii_hexdigit());

    if is_hex {
        let bytes = hex::decode(hex_body)?;
        let key_bytes: [u8; 32] = bytes.as_slice().try_into().map_err(|_| {
            SdkError::Crypto("DEV_SECRET_KEY hex must decode to 32 bytes".into())
        })?;
        return Signer::from_secret_key_bytes(&key_bytes);
    }

    Signer::from_secret_key_base64(trimmed)
}

impl LocalSignerService {
    pub fn from_config(config: &Config) -> SdkResult<Self> {
        let signer = if let Some(encoded) = &config.dev_secret_key {
            let signer = load_signer_from_dev_secret_key(encoded)?;
            tracing::info!(address = %signer.address(), "loaded dev signer from DEV_SECRET_KEY");
            signer
        } else {
            let signer = Signer::new();
            tracing::warn!(
                address = %signer.address(),
                secret_key = %signer.export_secret_key(),
                "DEV_SECRET_KEY not set; using ephemeral dev signer — add DEV_SECRET_KEY (hex or base64) to .env to keep this address across restarts"
            );
            signer
        };

        Ok(Self {
            secret_key_b64: signer.export_secret_key(),
            address: signer.address(),
        })
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
