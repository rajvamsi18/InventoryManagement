# SMKG Backend Plan

The FastAPI backend is not implemented yet. The frontend intentionally remains usable without it.

## Speech-to-Text Proxy (implemented)

`worker/` holds a small Cloudflare Worker with two stateless routes: it proxies
recorded audio to Sarvam so the optional voice engine never embeds its API key in
the browser bundle, and it sends user-submitted WhatsApp text to Workers AI to
extract Only Order draft lines. The latter does not read or write inventory and
returns no prices. The Worker is unrelated to the FastAPI sync backend below — see
`worker/README.md` for setup and deployment.

## Next Backend Scope


- FastAPI application and configuration.
- PostgreSQL connection using a local `.env` file.
- SQLAlchemy models for products, orders, and order items.
- Pydantic request/response schemas.
- `POST /api/sync` to upsert local product and sales data.
- Sync status and validation/error responses.
- Tests with pytest and a separate test database.

## Sync Contract Direction

The PWA will read its complete IndexedDB state, including `products`, `orders`, and `orderItems`, then send it to FastAPI. Every record has a stable UUID and timestamps. The server will use those for idempotent upserts and conflict handling.

## Connectivity Constraint

A PWA deployed on GitHub Pages is HTTPS. It cannot directly call an insecure `http://` API on a personal laptop. Production sync needs HTTPS through a secure private-network solution such as Tailscale, a local HTTPS proxy, or a cloud deployment. Do not configure router port forwarding.
