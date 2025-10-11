# DeepWeb Search · Roadmap

This roadmap captures the high-level priorities for turning the current prototype into a production-grade multi-source search platform. Timelines are indicative; adjust as the project evolves.

---

## ✅ Current Prototype (v0.1)

- Docker Compose stack with frontend, backend, and supporting services.
- FastAPI `/api/search` endpoint orchestrating pluggable adapters.
- DuckDuckGo source adapter (clearnet) with max 5 results.
- React dashboard with configurable sources, languages, and status feedback.

---

## 🟡 Short Term (MVP)

1. **Source Integrations**
   - Add additional clearnet providers (e.g., Google Custom Search, Bing Web Search).
   - Implement internal caching to reduce duplicate external requests.
2. **Persistence Layer**
   - Store searches and results in Postgres for history and analytics.
   - Expose `/api/history` and pagination in the UI.
3. **Observability & Reliability**
   - Add structured logging and Prometheus metrics in the backend.
   - Health checks for external dependencies (DuckDuckGo, future APIs).
4. **Testing & QA**
   - Unit tests for source adapters and search orchestration.
   - End-to-end smoke tests (e.g., Playwright/Cypress).

---

## 🟠 Mid Term (v0.5)

1. **Deep Web Crawling**
   - Build asynchronous crawlers targeting authenticated forums/databases.
   - Normalise content, deduplicate, and index via Elasticsearch.
2. **Dark Web Support**
   - Route crawler traffic through Tor proxy with rate limiting and safety checks.
   - Content moderation pipeline to flag illegal or sensitive material.
3. **Realtime Processing**
   - Replace mocked WebSocket with streaming updates from active crawlers.
   - Introduce task queues/workers (Celery/RQ) backed by Redis.
4. **Security & Compliance**
   - API authentication (JWT/OAuth) and audit logging.
   - Configurable content filters (blacklists/whitelists, jurisdiction constraints).

---

## 🔵 Long Term (v1.0+)

1. **Advanced Ranking & Analytics**
   - Combine signals from multiple sources using scoring heuristics/ML.
   - Provide dashboards with aggregate insights and trend analysis.
2. **User Experience Enhancements**
   - Saved searches, alerts, and collaboration features.
   - Internationalisation and accessibility improvements.
3. **Deployment Hardening**
   - Helm charts / Terraform modules for cloud deployments.
   - CI/CD pipelines with automated scans and staging environments.
4. **Compliance & Legal**
   - Document acceptable use policies, consent flows, and data retention rules.
   - Integrate automated compliance checks for monitored markets.

---

## 📌 Backlog / Ideas

- Entity extraction (named entities, sentiment analysis).
- Browser-based harvesting for tricky JavaScript-heavy targets.
- Plugin marketplace for community-contributed source adapters.
- Offline mode with local index snapshots.

---

## How to Contribute

- Discuss roadmap updates in issues/PRs referencing specific milestones.
- Tag work with `short-term`, `mid-term`, or `long-term` to match the sections above.
- Keep documentation (README, INSTALLATION, USAGE) synchronized with feature changes.
