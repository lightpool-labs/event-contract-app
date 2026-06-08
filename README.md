# Event Contract App

MVP web app for LightPool event contracts.

## Structure

```
external/event-contract-app/
├── backend/     Rust (Axum) API + lightpool-sdk
├── frontend/    Next.js UI
└── docker-compose.yml
```

## Quick start

### 1. Postgres (optional for now)

```bash
docker compose up -d
psql postgres://event_app:event_app@127.0.0.1:5432/event_contract_app -f backend/migrations/001_init.sql
```

### 2. Backend

```bash
cd external/event-contract-app/backend
cp .env.example .env
cargo run
```

API: `http://127.0.0.1:3001/api`

### 3. Frontend

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

UI: `http://127.0.0.1:3000`

### 4. LightPool node

Start a local node on `http://127.0.0.1:26300` (default RPC port).

Check readiness:

```bash
curl http://127.0.0.1:3001/api/ready
curl http://127.0.0.1:3001/api/markets
```

## API routes (scaffold)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Liveness |
| GET | `/api/ready` | Node connectivity |
| GET | `/api/markets` | List markets |
| GET | `/api/markets/:id` | Market detail |
| POST | `/api/orders` | Place order (stub) |
| POST | `/api/orders/:id/cancel` | Cancel order (stub) |
| GET | `/api/orders` | List orders |
| GET | `/api/account/balances` | Balances (stub) |

## Next steps

1. Wire `POST /orders` to `ActionBuilder::place_order` via agent signer
2. Replace seed data with PostgreSQL + event indexer
3. Add dev-login / MetaMask auth
4. Real balance queries via SDK `call` + `get_balance`
