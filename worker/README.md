# SMKG Cloudflare Worker

A small stateless Cloudflare Worker for Sarvam speech transcription and Only Order
message parsing. It holds no inventory/order data and needs no database.

## Why this exists

SMKG's frontend is a static PWA (GitHub Pages) with no backend of its own. The
Worker keeps the Sarvam API key out of the browser, and provides the AI endpoint
used to convert a WhatsApp message into reviewable Only Order draft lines.

Workers AI is configured as an `AI` binding. The `/read-list` endpoint uses
`@cf/qwen/qwen3-30b-a3b-fp8`; it receives only the pasted/shared message and returns
product name, optional volume, quantity, and whether quantity `1` was assumed. It
does not receive inventory records or prices. No AI inference request is made until
the user chooses Read list, and no order is saved until the user submits it. The
original message remains available beside the extracted draft so missed lines can
be caught during review. Clear size modifiers such as big, medium, or small are
requested as Volume rather than part of the product name. The model request enables Workers AI JSON mode to reduce
malformed extraction responses.

The route limits messages to 10,000 characters and applies a best-effort limit of
12 requests per minute per source IP and Cloudflare location. Workers AI's free
allocation is 10,000 Neurons per day; usage above that requires a Workers Paid
plan. Local `wrangler dev` AI inference still uses the Cloudflare account quota.

## One-time setup

1. Install dependencies: `cd worker && npm ci`
2. Log in to Cloudflare: `npx wrangler login`
3. Enable Workers AI for the Cloudflare account. No separate model API key is used.
4. Get a Sarvam API key from https://dashboard.sarvam.ai
5. Set the secret (never commit it): `npx wrangler secret put SARVAM_API_KEY`
6. Update `ALLOWED_ORIGIN` in `wrangler.toml` to your real GitHub Pages URL.
7. Deploy: `npm run deploy` — this prints the worker's URL
   (e.g. `https://smkg-stt-proxy.<your-subdomain>.workers.dev`).
8. In `frontend/.env` (or your GitHub Pages build variables), set:
   `VITE_SARVAM_PROXY_URL=<the worker URL from step 7>`
9. Rebuild and redeploy the frontend.

## Local development

`npm run dev` runs the worker locally with `wrangler dev`. Point
`VITE_SARVAM_PROXY_URL` at the printed local URL while testing.

## Request contracts

`POST /` with `multipart/form-data` for speech-to-text:
- `file` — the recorded audio clip (required)
- `language_code` — e.g. `en-IN` or `te-IN` (optional, defaults to `en-IN`)

Response: Sarvam's JSON response body, forwarded as-is (includes a `transcript` field).

`POST /read-list` with JSON for Only Order parsing:

```json
{"text":"WhatsApp message to parse"}
```

The response is `{ "items": [{ "productName", "volume", "quantity", "quantityAssumed" }] }`.
No price or total is returned. The AI endpoint requires internet; manual order entry
continues to work offline. An installed PWA can receive text through Android Chrome's
share sheet; iOS users can copy the message and paste it into Read List.
