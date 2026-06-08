use std::env;

#[derive(Clone, Debug)]
pub struct Config {
    pub host: String,
    pub port: u16,
    pub lightpool_rpc_url: String,
    pub database_url: String,
}

impl Config {
    pub fn from_env() -> Self {
        Self {
            host: env::var("HOST").unwrap_or_else(|_| "0.0.0.0".into()),
            port: env::var("PORT")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(3001),
            lightpool_rpc_url: env::var("LIGHTPOOL_RPC_URL")
                .unwrap_or_else(|_| "http://127.0.0.1:26300".into()),
            database_url: env::var("DATABASE_URL").unwrap_or_else(|_| {
                "postgres://event_app:event_app@127.0.0.1:5432/event_contract_app".into()
            }),
        }
    }
}
