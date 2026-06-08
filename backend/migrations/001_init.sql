-- Event contract app schema (MVP)

CREATE TABLE IF NOT EXISTS users (
    id              UUID PRIMARY KEY,
    lp_address      TEXT NOT NULL UNIQUE,
    agent_address   TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS markets (
    id                  UUID PRIMARY KEY,
    market_address      TEXT NOT NULL UNIQUE,
    question            TEXT NOT NULL,
    question_hash       BYTEA NOT NULL,
    collateral_token    TEXT NOT NULL,
    yes_token           TEXT NOT NULL,
    no_token            TEXT NOT NULL,
    yes_spot_market     TEXT NOT NULL,
    no_spot_market      TEXT NOT NULL,
    state               TEXT NOT NULL,
    resolution_deadline BIGINT NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS orders (
    id              UUID PRIMARY KEY,
    order_id        TEXT,
    user_address    TEXT NOT NULL,
    market_id       UUID NOT NULL REFERENCES markets(id),
    outcome         TEXT NOT NULL,
    side            TEXT NOT NULL,
    price           BIGINT NOT NULL,
    size            BIGINT NOT NULL,
    filled          BIGINT NOT NULL DEFAULT 0,
    status          TEXT NOT NULL,
    tx_digest       TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orders_user_status ON orders(user_address, status);
