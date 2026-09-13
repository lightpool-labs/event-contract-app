-- App-local market display metadata (not stored in shared clob-index).

CREATE TABLE IF NOT EXISTS market_metadata (
    market_address     TEXT PRIMARY KEY,
    slug               TEXT NOT NULL,
    event_slug         TEXT,
    group_item_title   TEXT,
    icon_url           TEXT,
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_market_metadata_slug
    ON market_metadata (lower(slug));
