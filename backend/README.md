# ec-eclassroom backend (Cloudflare Workers)

This folder contains a lightweight Cloudflare Workers backend scaffold for local development.

Endpoints provided (in-memory store):
- `GET /health` or `/` — basic health check
- `POST /api/generate-cards` — body: `{ text, count }` returns mock cards
- `GET|POST|PUT|DELETE /api/classes` — simple class CRUD
- `GET|POST|PUT|DELETE /api/quizzes` — simple quiz CRUD

- `POST /api/ai/generate` — AI-powered generator (requires `OPENAI_API_KEY` secret)
 - `POST /api/groq` — Proxy GROQ queries to Sanity (requires `SANITY_TOKEN` secret)

Notes:
- This implementation uses an in-memory store (`STORE`), so data is ephemeral.
- For production, bind a KV namespace, D1, or Durable Objects and update `wrangler.toml` and `src/index.js` to use the binding.

Local development

1. Install Wrangler (if not installed):

```bash
npm install -g wrangler
```

2. From this folder run the dev server:

```bash
cd backend
wrangler dev
```

3. To publish, set `account_id` in `wrangler.toml` and run:

```bash
wrangler publish
```

AI endpoint setup

1. Add your OpenAI API key as a secret (do not store in repository):

```bash
cd backend
wrangler secret put OPENAI_API_KEY
```

2. Example request to AI endpoint:

```bash
curl -X POST https://<your-worker-url>/api/ai/generate \
	-H "Content-Type: application/json" \
	-d '{"prompt":"Summarize resistors, capacitors, and basic circuit concepts into 5 flashcards.", "count":5}'
```

If the secret is not configured the endpoint returns an error and you can instead use `/api/generate-cards` which is a local mock generator.

GROQ proxy setup

1. Add your Sanity token as a secret (do not store in repository):

```bash
cd backend
wrangler secret put SANITY_TOKEN
```

2. Example request to GROQ proxy:

```bash
curl -X POST https://<your-worker-url>/api/groq \
	-H "Content-Type: application/json" \
	-d '{"projectId":"yourProjectId","dataset":"production","query":"*[] | order(_createdAt desc)[0..9]"}'
```

The proxy forwards your GROQ `query` (and optional `params`) to Sanity and returns the raw Sanity response. Keep the `SANITY_TOKEN` secret private.

Production publish (Cloudflare)

1. Create a Cloudflare API Token with permissions to manage Workers or use your Global API Key and obtain your `account_id`.

2. Add repository secrets in GitHub (Repository Settings → Secrets):

	- `CF_API_TOKEN` — Cloudflare API token
	- `CF_ACCOUNT_ID` — your Cloudflare account id
	- `SANITY_TOKEN` — your Sanity read token (if using GROQ proxy)
	- `OPENAI_API_KEY` — (optional) OpenAI key for AI endpoint

3. The included GitHub Actions workflow will publish the Worker automatically when you push to the `main` branch. The workflow uses `npx wrangler publish` from the `backend` folder.

4. After publishing, set the frontend to use your worker URL (example):

```js
localStorage.setItem('backendUrl', 'https://<your-worker-subdomain>.workers.dev');
// or call setBackendUrl('https://<your-worker-subdomain>.workers.dev') in console
```

If you prefer manual publishing you can run locally:

```bash
cd backend
wrangler publish
```
