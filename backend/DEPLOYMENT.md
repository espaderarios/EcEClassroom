# Complete Deployment Guide for EcEClassroom

This guide walks you through deploying EcEClassroom with Cloudflare D1 database and Workers.

## System Requirements

- **Node.js**: v16+ (check with `node --version`)
- **npm**: v8+ (check with `npm --version`)
- **Git**: Latest version
- **Wrangler CLI**: Latest (`npm install -g @cloudflare/wrangler`)
- **Cloudflare Account**: Free tier or higher with Workers enabled

## Step-by-Step Deployment

### 1. Prerequisites ✓

Ensure you have Cloudflare CLI installed:

```powershell
npm install -g @cloudflare/wrangler
wrangler --version
```

Authenticate with Cloudflare:

```powershell
wrangler login
```

This will open a browser to authorize Wrangler with your Cloudflare account.

### 2. Create D1 Database

From the `backend` directory:

```powershell
cd backend
wrangler d1 create eclassroom
```

**Output will look like:**
```
✓ Create migration file at migrations/0001_init.sql
Created database 'eclassroom' in namespace binding.

[[d1_databases]]
binding = "DB"
database_name = "eclassroom"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

**Copy the `database_id` value** - you'll need it next.

### 3. Update wrangler.toml

Edit `backend/wrangler.toml` and replace `YOUR_DB_ID` with your actual database ID:

```toml
[[d1_databases]]
binding = "DB"
database_name = "eclassroom"
database_id = "YOUR_DB_ID"  # ← Replace this with your ID
```

### 4. Run Database Migration

Initialize the database schema:

```powershell
wrangler d1 execute eclassroom --file migrations/0001_init.sql --remote
```

**Expected output:**
```
✓ Executed migration _0001_init on remote database eclassroom
Created tables:
  - users
  - flashcard_sets
  - flashcards
  - quiz_results
```

### 5. Deploy Worker

Deploy the Worker with D1 binding:

```powershell
wrangler deploy
```

**Expected output:**
```
✓ Deployed to ec-eclassroom-backend.espaderarios.workers.dev
```

### 6. Verify Deployment

Test the health endpoint:

```powershell
curl https://ec-eclassroom-backend.espaderarios.workers.dev/health
```

**Expected response:**
```json
{
  "ok": true,
  "name": "ec-eclassroom-backend",
  "version": "2.0.0"
}
```

### 7. Test Database Operations

Create a test flashcard:

```powershell
$body = @{
  set_id = "set_test"
  question = "What is D1?"
  answer = "Cloudflare's distributed SQLite database"
} | ConvertTo-Json

Invoke-RestMethod -Uri "https://ec-eclassroom-backend.espaderarios.workers.dev/api/flashcards?userId=test_user" `
  -Method Post `
  -Body $body `
  -ContentType "application/json"
```

Retrieve flashcards:

```powershell
Invoke-RestMethod -Uri "https://ec-eclassroom-backend.espaderarios.workers.dev/api/flashcards?userId=test_user" `
  -Method Get
```

## Automated Deployment Script

For convenience, use the provided deployment script:

```powershell
cd backend
.\scripts\deploy.ps1
```

This script will:
1. Validate prerequisites
2. Create D1 database
3. Update wrangler.toml automatically
4. Run migrations
5. Deploy Worker
6. Display summary with next steps

## Testing Script

After deployment, run the test suite:

```powershell
.\scripts\test.ps1
```

This will:
1. Test health endpoint
2. Create sample flashcard sets
3. Create sample flashcards
4. Verify retrieval operations
5. Display all results

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  Frontend (classrio.me)                             │
│  - Vue.js / Vanilla JS                              │
│  - Data sync on login                               │
└────────────────────┬────────────────────────────────┘
                     │
         ┌───────────┴───────────┐
         │                       │
         ▼                       ▼
    Data CRUD                  AI Generation
    (Flashcards)              (Groq API)
         │                       │
         ▼                       ▼
┌──────────────────────┐   ┌──────────────────────┐
│ Cloudflare Worker    │   │ Render Express       │
│ ec-eclassroom-      │   │ eclassroom-backend  │
│ backend.workers.dev │   │ .onrender.com       │
└──────────────┬───────┘   └──────────────────────┘
               │
               ▼
        ┌──────────────┐
        │ D1 Database  │
        │ (SQLite)     │
        └──────────────┘
            Tables:
            - users
            - flashcard_sets
            - flashcards
            - quiz_results
```

## API Endpoints

### Create Flashcard
```
POST /api/flashcards?userId=USER_ID
Content-Type: application/json

{
  "set_id": "set_123",
  "question": "Question text?",
  "answer": "Answer text"
}
```

### Get Flashcards
```
GET /api/flashcards?userId=USER_ID&setId=SET_ID (optional)
```

### Update Flashcard
```
PUT /api/flashcards/CARD_ID?userId=USER_ID
Content-Type: application/json

{
  "question": "Updated question?",
  "answer": "Updated answer"
}
```

### Delete Flashcard
```
DELETE /api/flashcards/CARD_ID?userId=USER_ID
```

## Monitoring & Logs

View Worker logs in real-time:

```powershell
wrangler tail
```

Monitor database in Cloudflare Dashboard:
1. Go to https://dash.cloudflare.com
2. Select your account
3. Navigate to Workers → D1 → eclassroom
4. View queries and performance metrics

## Troubleshooting

### "Database not available"
- Ensure database_id is correct in wrangler.toml
- Verify DB binding exists: check `[[d1_databases]]` section

### "Failed to execute migration"
- Check migration file syntax
- Ensure migrations/0001_init.sql exists
- Try: `wrangler d1 execute eclassroom --file migrations/0001_init.sql --local`

### "Wrangler login fails"
- Clear cache: `wrangler logout && wrangler login`
- Ensure you have a Cloudflare account
- Check internet connectivity

### "userId required error"
- All flashcard operations require `?userId=X` query parameter
- This scopes data to the authenticated user

### Deployment fails
- Run `wrangler publish` with verbose output: `WRANGLER_LOG=debug wrangler publish`
- Check Wrangler version: `wrangler --version`
- Update if needed: `npm install -g @cloudflare/wrangler@latest`

## Next Steps

1. **Configure GitHub Actions** (optional)
   - Add CI/CD for automatic Worker deployment on push
   - See `.github/workflows/deploy-worker.yml`

2. **Set up monitoring**
   - Enable Cloudflare Workers Analytics
   - Set up alerts for errors

3. **Configure production environment**
   - Set proper CORS headers for production domain
   - Enable rate limiting
   - Add authentication for sensitive endpoints

4. **Database backups**
   - Enable automatic backups in Cloudflare dashboard
   - Monitor storage usage

5. **Performance optimization**
   - Add database indexes for common queries
   - Monitor D1 query performance
   - Cache frequently accessed data

## Support & Resources

- **D1 Documentation**: https://developers.cloudflare.com/d1/
- **Workers Documentation**: https://developers.cloudflare.com/workers/
- **Wrangler CLI**: https://developers.cloudflare.com/workers/wrangler/
- **GitHub Repository**: https://github.com/espaderarios/EcEClassroom
