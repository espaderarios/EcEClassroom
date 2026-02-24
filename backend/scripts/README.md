# EcEClassroom Backend Scripts

Automated deployment and testing scripts for D1 database and Cloudflare Workers.

## Available Scripts

### `deploy.ps1` - Complete Deployment (Windows/PowerShell)

**Purpose**: Automates the entire D1 setup and Worker deployment process.

**Usage**:
```powershell
cd backend
.\scripts\deploy.ps1
```

**What it does**:
1. ✓ Checks prerequisites (wrangler, git installed)
2. ✓ Creates D1 database (`eclassroom`)
3. ✓ Extracts database ID automatically
4. ✓ Updates wrangler.toml with correct ID
5. ✓ Runs database migration (creates tables)
6. ✓ Deploys Worker to Cloudflare
7. ✓ Displays summary with Worker URL and test commands

**Output**: Color-coded terminal output with step status and summary
```
[✓] Prerequisites check passed
[✓] D1 Database created: eclassroom
[✓] Database ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
[✓] wrangler.toml updated
[✓] Migration executed
[✓] Worker deployed

Worker URL: https://ec-eclassroom-backend.espaderarios.workers.dev
Next: Run .\scripts\test.ps1 to verify
```

**Requires**:
- Cloudflare account
- `wrangler login` already executed
- `wrangler` CLI installed globally

**Returns exit code**: 0 (success) or error message (failure)

---

### `deploy.sh` - Complete Deployment (Bash/Linux/Mac)

**Purpose**: Same as deploy.ps1 but for Unix-like systems.

**Usage**:
```bash
cd backend
bash scripts/deploy.sh
```

**What it does**: Identical to deploy.ps1 but uses bash syntax
- Checks prerequisites
- Creates D1 database
- Extracts database ID using grep/awk
- Updates wrangler.toml using sed
- Runs migration
- Deploys Worker

**Output**: ANSI color-coded terminal output

**Requires**: bash, wrangler, git

---

### `test.ps1` - Automated Testing Suite (Windows/PowerShell)

**Purpose**: Tests all D1 endpoints to verify deployment success.

**Usage**:
```powershell
.\scripts\test.ps1
```

**What it does**: Sends HTTP requests to the deployed Worker and validates responses

**Tests performed**:
1. **Health Check**: GET `/health`
   - Verifies Worker is responding
   - Checks version and status

2. **Create Flashcard Set**: POST `/api/flashcard-sets`
   - Creates a sample set in the database
   - Tests write permissions

3. **Create Flashcard**: POST `/api/flashcards?userId=test_user`
   - Adds a question/answer pair
   - Tests parameterized requests

4. **Get All Flashcards**: GET `/api/flashcards?userId=test_user`
   - Retrieves user's flashcards
   - Tests read operations

5. **Get Flashcards by Set**: GET `/api/flashcards?userId=test_user&setId=SET_ID`
   - Filters by flashcard set
   - Tests query parameters

**Output**: Full request/response for each test, includes curl commands for manual re-testing

```
[Test 1] Health Check
Request: GET https://ec-eclassroom-backend.espaderarios.workers.dev/health
Response: {
  "ok": true,
  "name": "ec-eclassroom-backend",
  "version": "2.0.0"
}
Status: ✓ PASS

[Test 2] Create Flashcard Set
Request: POST /api/flashcard-sets
Body: {"name":"Test Set","description":"Test"}
Response: {"id":"set_123","created_at":"2024-01-15T10:30:00Z"}
Status: ✓ PASS
```

**Requires**: PowerShell 5.0+, Worker already deployed

**Exit codes**: 0 (all pass) or continues through failures to show all results

---

## Usage Workflow

### First-time setup
```powershell
# 1. Deploy everything automatically
.\scripts\deploy.ps1

# 2. Verify all endpoints work
.\scripts\test.ps1

# 3. If tests pass, ready for production!
```

### Troubleshooting failed script
```powershell
# Run with verbose output for debugging
$DebugPreference = 'Continue'
.\scripts\deploy.ps1

# Or use manual steps in DEPLOYMENT_QUICKSTART.md
```

### Before pushing to GitHub
```powershell
# Make sure these pass
.\scripts\test.ps1

# Then commit changes
git add -A
git commit -m "feat: D1 database deployed and tested"
git push
```

---

## Script Internals

### deploy.ps1 Breakdown

```powershell
# 1. Validate Prerequisites
Test-Command "wrangler"
Test-Command "git"

# 2. Create Database
$output = wrangler d1 create eclassroom
$databaseId = Extract-DatabaseId $output

# 3. Update Configuration
Update-WranglerToml $databaseId

# 4. Run Migrations
wrangler d1 execute eclassroom `
  --file migrations/0001_init.sql `
  --remote

# 5. Deploy
wrangler publish

# 6. Display Results
Show-Summary
```

### test.ps1 Breakdown

```powershell
$baseUrl = "https://ec-eclassroom-backend.espaderarios.workers.dev"

# Helper function to make requests
function Test-Endpoint($method, $path, $body) {
    $url = "$baseUrl$path"
    Invoke-RestMethod -Uri $url -Method $method -Body $body
}

# Run 5 tests
Test-Endpoint "GET" "/health"
Test-Endpoint "POST" "/api/flashcard-sets" $setData
Test-Endpoint "POST" "/api/flashcards?userId=test_user" $cardData
Test-Endpoint "GET" "/api/flashcards?userId=test_user"
Test-Endpoint "GET" "/api/flashcards?userId=test_user&setId=$setId"
```

---

## Customization

### Change Worker Name
Edit deploy.ps1 line 15:
```powershell
$workerName = "my-custom-name"
wrangler d1 create $workerName
```

### Change Database Name
Update migration file name and script references:
```powershell
wrangler d1 create my-database
```

### Add Custom Tests
Extend test.ps1 with new test cases:
```powershell
# Test 6: Custom Endpoint
$response = Test-Endpoint "GET" "/api/custom-endpoint"
if ($response.status -eq "ok") {
    Write-Host "✓ Test 6 PASS" -ForegroundColor Green
}
```

---

## Common Errors & Fixes

### "Wrangler command not found"
```powershell
npm install -g @cloudflare/wrangler
wrangler --version  # Verify installation
```

### "Unauthorized" or "No such account"
```powershell
wrangler logout
wrangler login  # Opens browser for authentication
```

### "D1 database creation failed"
- Ensure Cloudflare account has Workers enabled
- Check quota limits in Cloudflare dashboard
- Try with different database name

### "Test script timeout"
- Worker takes ~30 seconds to deploy
- Wait and retry: `.\scripts\test.ps1`
- Or add 30-second delay: `Start-Sleep -Seconds 30; .\scripts\test.ps1`

### "Script execution disabled"
```powershell
# Run as Administrator
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# Then run script
.\scripts\deploy.ps1
```

---

## What's Next?

After successful deployment:

1. **Commit to GitHub**
   ```powershell
   git add backend/wrangler.toml
   git commit -m "Deploy: D1 database configured and migrated"
   git push
   ```

2. **Test with Frontend**
   - Flashcards will now sync across devices
   - Login on different device to verify persistence

3. **Monitor Logs**
   ```powershell
   wrangler tail  # Real-time Worker logs
   ```

4. **Scale if Needed**
   - Monitor D1 usage in Cloudflare dashboard
   - Plan migration to PostgreSQL if exceeding storage limits

---

## Support

- **Full Documentation**: See [DEPLOYMENT.md](../DEPLOYMENT.md)
- **Quick Start**: See [DEPLOYMENT_QUICKSTART.md](../DEPLOYMENT_QUICKSTART.md)
- **GitHub Issues**: https://github.com/espaderarios/EcEClassroom/issues
- **Cloudflare D1**: https://developers.cloudflare.com/d1/
