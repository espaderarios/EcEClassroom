# 🚀 Deployment Guide - EcEClassroom

This guide will help you deploy the EcEClassroom backend to Cloudflare Workers for **persistent cloud storage**, **cross-device sync**, and **multi-user collaboration**.

## Prerequisites

- A [Cloudflare account](https://dash.cloudflare.com/sign-up) (free tier works!)
- Node.js installed (v16 or later)
- Git (optional, for version control)

## Step-by-Step Deployment

### 1️⃣ Install Wrangler CLI

```powershell
npm install -g wrangler
```

### 2️⃣ Login to Cloudflare

```powershell
wrangler login
```

This will open your browser to authenticate with Cloudflare.

### 3️⃣ Create KV Namespaces

Navigate to the backend folder and create all required KV namespaces:

```powershell
cd backend

# Create production namespaces
npx wrangler kv:namespace create "CLASSES"
npx wrangler kv:namespace create "QUIZZES"
npx wrangler kv:namespace create "STUDENTS"
npx wrangler kv:namespace create "TEACHERS"
npx wrangler kv:namespace create "ENROLLMENTS"

# Create preview namespaces for local development
npx wrangler kv:namespace create "CLASSES" --preview
npx wrangler kv:namespace create "QUIZZES" --preview
npx wrangler kv:namespace create "STUDENTS" --preview
npx wrangler kv:namespace create "TEACHERS" --preview
npx wrangler kv:namespace create "ENROLLMENTS" --preview
```

**Important:** Each command will output an ID. **Copy these IDs!** You'll need them in the next step.

Example output:
```
✅ Created namespace "CLASSES" with ID: abc123def456ghi789
✅ Created preview namespace with ID: xyz789uvw456rst123
```

### 4️⃣ Update wrangler.toml

Open `backend/wrangler.toml` and replace the placeholder IDs with your actual namespace IDs:

```toml
name = "ec-eclassroom-backend"
main = "src/index.js"
compatibility_date = "2026-01-21"

# IMPORTANT: Add your Cloudflare account ID
# Find it at: https://dash.cloudflare.com/ (look in the URL or sidebar)
account_id = "YOUR_ACCOUNT_ID_HERE"

# KV Namespaces - Replace with YOUR actual IDs from step 3
[[kv_namespaces]]
binding = "CLASSES"
id = "abc123def456ghi789"  # Replace with your CLASSES production ID
preview_id = "xyz789uvw456rst123"  # Replace with your CLASSES preview ID

[[kv_namespaces]]
binding = "QUIZZES"
id = "your_quizzes_prod_id"
preview_id = "your_quizzes_preview_id"

[[kv_namespaces]]
binding = "STUDENTS"
id = "your_students_prod_id"
preview_id = "your_students_preview_id"

[[kv_namespaces]]
binding = "TEACHERS"
id = "your_teachers_prod_id"
preview_id = "your_teachers_preview_id"

[[kv_namespaces]]
binding = "ENROLLMENTS"
id = "your_enrollments_prod_id"
preview_id = "your_enrollments_preview_id"
```

### 5️⃣ Test Locally (Optional but Recommended)

```powershell
cd backend
npx wrangler dev
```

Visit `http://localhost:8787/health` to verify it's working. You should see:
```json
{"ok":true,"name":"ec-eclassroom-backend"}
```

### 6️⃣ Deploy to Production

```powershell
cd backend
npx wrangler deploy
```

🎉 **Success!** You'll see output like:
```
✨ Successfully published your worker
🌍 https://ec-eclassroom-backend.your-subdomain.workers.dev
```

**Copy this URL** - you'll need it for the frontend!

### 7️⃣ Configure Frontend

Open your app in a browser and update the backend URL. You can do this in two ways:

**Option A: Through Browser Console**
```javascript
setBackendUrl('https://ec-eclassroom-backend.your-subdomain.workers.dev');
```

**Option B: Update app.js default**
Find this line in `app.js`:
```javascript
function getBackendUrl() {
  return localStorage.getItem('backendUrl') || 'http://localhost:5000';
}
```

Change it to:
```javascript
function getBackendUrl() {
  return localStorage.getItem('backendUrl') || 'https://ec-eclassroom-backend.your-subdomain.workers.dev';
}
```

### 8️⃣ Verify It's Working

1. Open your app in a browser
2. Open Developer Console (F12)
3. Look for these messages:
   ```
   🔄 Syncing with backend...
   ✅ Backend sync complete
   ```

4. Create a class or update your profile
5. Open the app in a **different browser** or **incognito mode**
6. You should see your data synced! 🎉

## Testing Cross-Device Sync

1. Create a class on Device 1
2. Note the class code
3. Open the app on Device 2
4. Join the class using the code
5. Both devices should now show the same class data!

## Troubleshooting

### "Error: No account ID found"
- Add your `account_id` to `wrangler.toml`
- Find it at: https://dash.cloudflare.com/ → Workers & Pages → Overview

### "KV namespace not found"
- Make sure you ran all `kv:namespace create` commands
- Double-check the IDs in `wrangler.toml` match the output from step 3

### "CORS error in browser"
- The backend already includes CORS headers
- Clear browser cache and reload

### "Backend sync failed"
- Check the deployed URL is correct
- Test the health endpoint: `https://your-worker.workers.dev/health`
- Check browser console for specific error messages

### Data not syncing
- Open browser console and check for sync messages
- Verify `localStorage.getItem('backendUrl')` returns the correct URL
- Make sure you're connected to the internet

## Updating Your Deployment

Whenever you make changes to `backend/src/index.js`:

```powershell
cd backend
npx wrangler deploy
```

Changes are live immediately - no need to recreate KV namespaces!

## Cost

Cloudflare Workers **Free Tier** includes:
- ✅ 100,000 requests/day
- ✅ 1GB KV storage
- ✅ 1,000 KV writes/day
- ✅ 100,000 KV reads/day

This is **more than enough** for a classroom with hundreds of students! 🎓

## Security Notes

- KV data is stored on Cloudflare's edge network
- No authentication is built-in by default
- For production use, consider adding:
  - API key validation
  - Rate limiting
  - User authentication
  - Data encryption

## Need Help?

- Cloudflare Workers Docs: https://developers.cloudflare.com/workers/
- Cloudflare KV Docs: https://developers.cloudflare.com/kv/
- Wrangler CLI Docs: https://developers.cloudflare.com/workers/wrangler/

---

**You're all set!** Your EcEClassroom now has persistent cloud storage and works across all devices! 🚀
