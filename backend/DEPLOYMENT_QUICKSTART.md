# Quick Start: Deploy D1 Database

For Windows users, complete deployment in 1 command:

```powershell
cd backend
.\scripts\deploy.ps1
```

This automated script handles:
- D1 database creation
- Database ID extraction
- wrangler.toml configuration
- Migration execution
- Worker deployment

**Expected time**: 2-3 minutes

---

## Manual Deployment (if script fails)

### 1. Create Database
```powershell
cd backend
wrangler d1 create eclassroom
# Copy the database_id from output
```

### 2. Update wrangler.toml
Replace `YOUR_DB_ID` with your database ID:
```toml
[[d1_databases]]
binding = "DB"
database_name = "eclassroom"
database_id = "YOUR_DB_ID"
```

### 3. Run Migration
```powershell
wrangler d1 execute eclassroom --file migrations/0001_init.sql --remote
```

### 4. Deploy
```powershell
wrangler deploy
```

### 5. Test
```powershell
curl https://ec-eclassroom-backend.espaderarios.workers.dev/health
```

---

## Verify Everything Works

```powershell
.\scripts\test.ps1
```

Runs 5 tests:
1. ✓ Health check
2. ✓ Create flashcard set
3. ✓ Create flashcard
4. ✓ Get all flashcards
5. ✓ Get flashcards by set

---

## Production Domain

Your Worker is live at:
```
https://ec-eclassroom-backend.espaderarios.workers.dev
```

Frontend automatically routes here for data operations (getBackendUrl()).

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Command not found: wrangler" | `npm install -g @cloudflare/wrangler` |
| "Unauthorized" | Run `wrangler login` |
| Database creation fails | Ensure Cloudflare account has Workers enabled |
| Script won't run | Right-click PowerShell > Run as Administrator |
| Test fails | Check Worker URL is accessible (may take 30 seconds after deploy) |

---

## Full Documentation

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed setup, API reference, and monitoring.
