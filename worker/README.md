# SMKG Speech-to-Text Proxy

A tiny Cloudflare Worker that proxies audio clips to the Sarvam AI speech-to-text
API. It exists only to keep the Sarvam API key out of the browser bundle — it holds
no data and needs no database.

## Why this exists

SMKG's frontend is a static PWA (GitHub Pages) with no backend of its own. Calling
Sarvam directly from the browser would expose the API key to anyone using dev
tools. This worker sits between the two: the browser sends a recorded audio clip
here, the worker attaches the secret key and forwards it to Sarvam, then returns
the transcript.

Runs on Cloudflare's free tier — no server or personal laptop needs to stay on.

## One-time setup

1. Install dependencies: `cd worker && npm install`
2. Log in to Cloudflare: `npx wrangler login`
3. Get a Sarvam API key from https://dashboard.sarvam.ai
4. Set the secret (never commit it): `npx wrangler secret put SARVAM_API_KEY`
5. Update `ALLOWED_ORIGIN` in `wrangler.toml` to your real GitHub Pages URL.
6. Deploy: `npm run deploy` — this prints the worker's URL
   (e.g. `https://smkg-stt-proxy.<your-subdomain>.workers.dev`).
7. In `frontend/.env` (or your GitHub Pages build secrets), set:
   `VITE_SARVAM_PROXY_URL=<the worker URL from step 6>`
8. Rebuild and redeploy the frontend.

## Local development

`npm run dev` runs the worker locally with `wrangler dev`. Point
`VITE_SARVAM_PROXY_URL` at the printed local URL while testing.

## Request contract

`POST /` with `multipart/form-data`:
- `file` — the recorded audio clip (required)
- `language_code` — e.g. `en-IN` or `te-IN` (optional, defaults to `en-IN`)

Response: Sarvam's JSON response body, forwarded as-is (includes a `transcript` field).
