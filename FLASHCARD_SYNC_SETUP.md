# Flashcard Sync Setup Guide

## Problem
Flashcards created on one device were not syncing to other devices even when logged in with the same Gmail account. This was because flashcards were only stored in browser localStorage, which is device-specific.

## Solution
Added backend synchronization for flashcards using Cloudflare KV storage, similar to how quizzes are synced.

## Changes Made

### 1. Backend Changes (`backend/src/index.js`)
- Added new API endpoint: `/api/flashcards`
- Handles GET, POST, PUT, DELETE operations for flashcard data
- Stores flashcards in Cloudflare KV namespace

### 2. Frontend Changes (`index.html`)
- Enhanced `dataSdk` with backend sync capabilities:
  - `syncToBackend()` - Uploads changes to backend
  - `loadFromBackend()` - Downloads data from backend
  - Modified `init()` - Merges local and backend data on startup
  - Modified `create()` - Syncs new items to backend
  - Modified `update()` - Syncs updates to backend
  - Modified `delete()` - Syncs deletions to backend

### 3. Configuration (`backend/wrangler.toml`)
- Added FLASHCARDS KV namespace binding

## Setup Instructions

### Step 1: Create KV Namespace
Run these commands in your terminal from the `backend` directory:

```bash
cd backend

# Create production namespace
npx wrangler kv:namespace create "FLASHCARDS"

# Create preview namespace (for testing)
npx wrangler kv:namespace create "FLASHCARDS" --preview
```

### Step 2: Update wrangler.toml
Replace the placeholder IDs in `backend/wrangler.toml` with the actual IDs from Step 1:

```toml
[[kv_namespaces]]
binding = "FLASHCARDS"
id = "YOUR_PRODUCTION_ID_HERE"
preview_id = "YOUR_PREVIEW_ID_HERE"
```

### Step 3: Deploy Backend
```bash
cd backend
npx wrangler deploy
```

### Step 4: Test Sync

1. **On Device 1:**
   - Sign in with your Gmail account
   - Create some flashcards
   - They should automatically sync to the backend

2. **On Device 2:**
   - Sign in with the same Gmail account
   - Refresh the page
   - Your flashcards should appear!

## How It Works

### Initial Load (when you open the app)
1. Loads flashcards from localStorage
2. If authenticated with Gmail:
   - Fetches flashcards from backend
   - Merges backend data with local data
   - Uploads any local-only items to backend
   - Downloads any backend-only items locally

### When Creating/Editing/Deleting
1. Updates localStorage immediately (instant UI update)
2. Syncs change to backend asynchronously
3. If sync fails, data is preserved locally

### Data Merging Strategy
- Backend and local data are merged by ID
- Items existing in either location are preserved
- No data loss during sync

## Troubleshooting

### Flashcards not syncing?
1. Check browser console for sync errors
2. Verify you're logged in with Gmail (check Profile tab)
3. Ensure backend is deployed and running
4. Check network tab for failed API requests

### Data conflicts?
- The system merges data rather than overwriting
- Both local and backend items are preserved
- No flashcards should be lost during sync

### Backend errors?
```bash
# Check backend logs
cd backend
npx wrangler tail
```

## Migration Notes

### For Existing Users
- Existing flashcards in localStorage will be automatically uploaded to backend on next login
- No manual migration needed
- Data remains in localStorage as backup

### For New Users
- Flashcards automatically sync from the start
- Works seamlessly across all devices

## Future Improvements
- [ ] Add conflict resolution for simultaneous edits
- [ ] Add sync status indicator in UI
- [ ] Add manual sync button
- [ ] Add sync timestamp display
- [ ] Implement real-time sync with WebSockets
