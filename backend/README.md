# ec-eclassroom backend (Cloudflare Workers)

This folder contains a Cloudflare Workers backend with **persistent KV storage** for cross-device sync and multi-user collaboration.

## Features

✅ **Persistent Cloud Storage** - Data stored in Cloudflare KV (survives restarts)  
✅ **Cross-Device Sync** - Access your data from any browser/device  
✅ **Multi-User Collaboration** - Share classes between users  
✅ **RESTful API** - Full CRUD operations for all resources

## Endpoints

### Core Resources (with KV persistence)
- `GET|POST|PUT|DELETE /api/classes` — Class management
- `GET|POST|PUT|DELETE /api/quizzes` — Quiz management
- `GET|POST|PUT|DELETE /api/students` — Student profiles
- `GET|POST|PUT|DELETE /api/teachers` — Teacher profiles
- `GET|POST|PUT|DELETE /api/enrollments` — Class enrollments

### Utility Endpoints
- `GET /health` or `/` — Health check
- `POST /api/generate-cards` — Mock card generator
- `POST /api/ai/generate` — AI-powered generator (requires `OPENAI_API_KEY` secret)
- `POST /api/groq` — Proxy GROQ queries to Sanity (requires `SANITY_TOKEN` secret)

## Quick Start

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Create KV Namespaces

Create the required KV namespaces in your Cloudflare account:

```bash
# Create production namespaces
npx wrangler kv:namespace create "CLASSES"
npx wrangler kv:namespace create "QUIZZES"
npx wrangler kv:namespace create "STUDENTS"
npx wrangler kv:namespace create "TEACHERS"
npx wrangler kv:namespace create "ENROLLMENTS"

# Create preview namespaces for development
npx wrangler kv:namespace create "CLASSES" --preview
npx wrangler kv:namespace create "QUIZZES" --preview
npx wrangler kv:namespace create "STUDENTS" --preview
npx wrangler kv:namespace create "TEACHERS" --preview
npx wrangler kv:namespace create "ENROLLMENTS" --preview
```

### 3. Update wrangler.toml

Copy the namespace IDs from the output above and update `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "CLASSES"
id = "your_classes_namespace_id_here"
preview_id = "your_classes_preview_namespace_id_here"

# ... repeat for other namespaces
```

### 4. Local Development

```bash
npx wrangler dev
```

The server will start at `http://localhost:8787` by default.

### 5. Deploy to Production

```bash
# Set your Cloudflare account ID in wrangler.toml first
# account_id = "your_account_id"

npx wrangler deploy
```

After deployment, you'll get a URL like: `https://ec-eclassroom-backend.your-subdomain.workers.dev`

### 6. Update Frontend

Update your frontend to use the deployed URL:

```javascript
// In your app.js or settings
setBackendUrl('https://ec-eclassroom-backend.your-subdomain.workers.dev');
```

## Optional: AI Endpoint Setup

1. Add your OpenAI API key as a secret (do not store in repository):

```bash
cd backend
npx wrangler secret put OPENAI_API_KEY
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
