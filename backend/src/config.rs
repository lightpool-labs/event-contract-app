use std::env;

#[derive(Clone, Debug)]
pub struct Config {
    pub host: String,
    pub port: u16,
    pub clob_index_url: String,
    pub database_url: String,
    pub dev_secret_key: Option<String>,
    pub cash_token_address: Option<String>,
    pub cash_token_symbol: String,
}

impl Config {
    pub fn from_env() -> Self {
        Self {
            host: env::var("HOST").unwrap_or_else(|_| "0.0.0.0".into()),
            port: env::var("PORT")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(3001),
            clob_index_url: env::var("CLOB_INDEX_URL")
                .unwrap_or_else(|_| "http://127.0.0.1:3002".into()),
            database_url: env::var("DATABASE_URL").unwrap_or_else(|_| {
                "postgres://event_app:event_app@127.0.0.1:5432/event_contract_app".into()
            }),
            dev_secret_key: env::var("DEV_SECRET_KEY").ok().filter(|v| !v.trim().is_empty()),
            cash_token_address: env::var("CASH_TOKEN_ADDRESS")
                .ok()
                .filter(|v| !v.trim().is_empty()),
            cash_token_symbol: env::var("CASH_TOKEN_SYMBOL")
                .ok()
                .filter(|v| !v.trim().is_empty())
                .unwrap_or_else(|| "USDT".into()),
        }
    }
}
