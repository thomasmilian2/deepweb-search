# DeepWeb Search

DeepWeb Search is an experimental multi-source discovery platform. The current prototype combines a FastAPI backend and a React dashboard to run clearnet searches (DuckDuckGo) while preparing the ground for deep web and dark web integrations.

> ⚠️ **Note**  
> Only the DuckDuckGo connector is active today. Other sources (custom crawlers, Tor-based scrapers, etc.) are scaffolding and appear in the UI as disabled options.

---

## Features

- **Live DuckDuckGo results** – fetches real search results through a lightweight HTML adapter.
- **Configurable search form** – choose mode, languages, and sources from the dashboard.
- **Extensible architecture** – pluggable source adapters under `backend/sources/`.
- **Containerised stack** – Docker Compose orchestrates frontend, backend, Postgres, Elasticsearch, Redis, and a Tor proxy.

---

## Architecture Overview

| Layer        | Technology            | Purpose |
|-------------|-----------------------|---------|
| Frontend    | React 18 (CRA) + Nginx | Presents the dashboard, consumes REST endpoints, and shows status/errors. |
| Backend     | FastAPI + Uvicorn      | Hosts `/api/search`, orchestrates adapters, and exposes placeholder WebSocket + history endpoints. |
| Sources     | Python adapters        | `duckduckgo` is implemented; additional connectors will plug into the same interface. |
| Services    | Dockerised infrastructure | Postgres/Elasticsearch/Redis/Tor proxy reserved for richer crawling, storage, and analytics. |

Consult the [ROADMAP](ROADMAP.md) for planned enhancements.

---

## Getting Started

### Prerequisites

- Docker 20.10+
- Docker Compose 2.x
- ≥4 GB RAM and ≥10 GB free disk space

### Quick Start

```bash
# 1. Build and start the stack
./start.sh

# 2. Access the services
# Frontend UI : http://localhost:3000
# REST API    : http://localhost:8005
# API Docs    : http://localhost:8005/docs
```

To stop the environment:

```bash
docker-compose down
```

---

## Configuration

Duplicate the example env files if you want to override defaults:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

### Backend (`backend/.env`)

| Variable          | Default                                   | Description |
|-------------------|-------------------------------------------|-------------|
| `DATABASE_URL`    | `postgresql://user:pass@postgres:5432/deepweb_search` | Connection string for Postgres (unused in prototype). |
| `ELASTICSEARCH_URL` | `http://elasticsearch:9200`             | Elasticsearch endpoint (unused in prototype). |
| `REDIS_URL`       | `redis://redis:6379`                      | Redis endpoint (unused in prototype). |
| `TOR_PROXY`       | `socks5h://tor-proxy:9050`                | Tor proxy for future dark web crawling. |
| `SECRET_KEY`      | `change-this-secret-key`                  | Placeholder secret for future auth/session logic. |

### Frontend (`frontend/.env`)

| Variable             | Default                         | Description |
|----------------------|---------------------------------|-------------|
| `REACT_APP_API_URL`  | `http://localhost:8005`         | Base REST endpoint. |
| `REACT_APP_WS_URL`   | `ws://localhost:8005/ws/search` | WebSocket endpoint (currently mock). |

---

## Usage

1. Open `http://localhost:3000`.
2. Enter a query, choose mode/languages, and ensure DuckDuckGo is selected.
3. Submit the form to see live results, source status, and any error messages.

### REST API

| Endpoint      | Method | Description |
|---------------|--------|-------------|
| `/api/search` | POST   | Aggregates results from the selected sources. |
| `/api/analyze` | POST  | Returns a static analysis mock (language intent, keywords). |
| `/api/history` | GET   | Placeholder (returns an empty list). |
| `/ws/search`  | WS     | Sends simulated websocket progress updates. |

Example request:

```bash
curl -s -X POST http://localhost:8005/api/search \
  -H "Content-Type: application/json" \
  -d '{"query":"openai","sources":["duckduckgo"],"languages":["en"],"mode":"aggregation"}'
```

---

## Development Notes

- The backend container runs `uvicorn --reload`, so local Python changes trigger hot reloads.
- Rebuild the frontend bundle with `docker-compose build frontend` after editing React code.
- Testing dependencies (`pytest`, `pytest-asyncio`) are listed but suites have not been authored yet.

---

## Troubleshooting

- **Port conflicts** – adjust `3000` (frontend) or `8005` (backend) in `docker-compose.yml`.
- **Empty search results** – confirm outbound internet access and DuckDuckGo availability.
- **Service churn** – supporting containers (Postgres, Elasticsearch, Redis, Tor) are provisioned for future features and may log idle states.

---

## License

MIT License (or company-specific licence if provided). Update this section when a formal licence file is added.
