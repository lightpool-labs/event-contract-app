-- Per-user agent secrets and authorization flag for MetaMask sessions.

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS agent_secret_encrypted TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS agent_authorized BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS auth_nonces (
    address     TEXT PRIMARY KEY,
    nonce       TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
