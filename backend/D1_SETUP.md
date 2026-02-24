# D1 Database Setup Guide

This guide walks you through setting up Cloudflare D1 (SQLite) for the EcEClassroom Worker.

## Overview

The app now uses a **hybrid architecture**:
- **Worker + D1**: Handles flashcard CRUD operations and user data persistence
- **Render Express**: Handles AI generation (Groq API calls)

## Prerequisites

1. **Cloudflare Account** with Workers enabled
2. **Wrangler CLI** installed: `npm install -g wrangler`
3. **Git** with access to the repository

## Step 1: Create D1 Database

```bash
cd backend
wrangler d1 create eclassroom
```

This outputs something like:
```
Your database has been created and bound to the eclassroom environment.
Database ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

## Step 2: Update wrangler.toml

Open `backend/wrangler.toml` and replace `YOUR_DB_ID` with the database ID from Step 1:

```toml
[[d1_databases]]
binding = "DB"
database_name = "eclassroom"
database_id = "YOUR_DB_ID"  # <- Replace this
```

## Step 3: Run Migration

Initialize the database schema:

```bash
# For local testing
wrangler d1 execute eclassroom --file migrations/0001_init.sql --local

# For production
wrangler d1 execute eclassroom --file migrations/0001_init.sql --remote
```

This creates:
- `users` table
- `flashcard_sets` table
- `flashcards` table
- `quiz_results` table

## Step 4: Deploy Worker

```bash
wrangler publish
```

## Step 5: Verify Setup

Test the health endpoint:

```bash
curl https://ec-eclassroom-backend.espaderarios.workers.dev/health
# Expected response:
# {"ok":true,"name":"ec-eclassroom-backend","version":"2.0.0"}
```

Test flashcard CRUD (requires auth):

```bash
curl -X GET "https://ec-eclassroom-backend.espaderarios.workers.dev/api/flashcards?userId=user123"
```

## Architecture

### Frontend Flow

```
classrio.me (GitHub Pages)
    ↓
getBackendUrl()
    ↓
Worker (D1 Database)
    ├── GET /api/flashcards?userId=X (fetch cards)
    ├── POST /api/flashcards (create card)
    ├── PUT /api/flashcards/:id (update)
    └── DELETE /api/flashcards/:id (delete)

For AI:
classrio.me
    ↓
getRenderBackendUrl()
    ↓
Render Express
    ├── POST /api/ai/generate (Groq API)
    └── POST /api/ai/quiz
```

### Database Schema

#### users
- `id` (TEXT, PRIMARY KEY)
- `email` (TEXT, UNIQUE)
- `name` (TEXT)
- `google_id` (TEXT, UNIQUE)
- `picture_url` (TEXT)
- `provider` (TEXT, default 'local')
- `authenticated` (BOOLEAN)
- `created_at`, `updated_at` (AUTO)

#### flashcard_sets
- `id` (TEXT, PRIMARY KEY)
- `user_id` (TEXT, FK → users.id)
- `name` (TEXT)
- `subject` (TEXT)
- `icon` (TEXT)
- `visibility` (TEXT)
- `created_at`, `updated_at` (AUTO)

#### flashcards
- `id` (TEXT, PRIMARY KEY)
- `user_id` (TEXT, FK → users.id)
- `set_id` (TEXT, FK → flashcard_sets.id)
- `question` (TEXT)
- `answer` (TEXT)
- `created_at`, `updated_at` (AUTO)

#### quiz_results
- `id` (TEXT, PRIMARY KEY)
- `user_id` (TEXT, FK → users.id)
- `set_id` (TEXT, FK → flashcard_sets.id, nullable)
- `score` (INTEGER)
- `total_questions` (INTEGER)
- `created_at` (AUTO)

## API Endpoints

### Create Flashcard

```bash
POST /api/flashcards?userId=USER_ID
Content-Type: application/json

{
  "id": "card_123",
  "set_id": "set_456",
  "question": "What is photosynthesis?",
  "answer": "Process plants use to convert light..."
}
```

### Get Flashcards

```bash
GET /api/flashcards?userId=USER_ID&setId=SET_ID (optional)

# Response: Array of flashcard objects
[
  {
    "id": "card_123",
    "user_id": "user_123",
    "set_id": "set_456",
    "question": "What is photosynthesis?",
    "answer": "...",
    "created_at": "2026-02-25T10:30:00Z"
  }
]
```

### Update Flashcard

```bash
PUT /api/flashcards/CARD_ID?userId=USER_ID
Content-Type: application/json

{
  "question": "Updated question",
  "answer": "Updated answer"
}
```

### Delete Flashcard

```bash
DELETE /api/flashcards/CARD_ID?userId=USER_ID
```

## Troubleshooting

### "Database not available"

Make sure `database_id` in `wrangler.toml` matches your D1 database ID.

### "userId required"

All flashcard operations require `userId` query parameter to scope data correctly.

### Migration failed

Ensure the migration file exists at `backend/migrations/0001_init.sql`.

### Can't connect to Worker

Check that:
1. Worker is deployed: `wrangler publish`
2. Domain is correct: `ec-eclassroom-backend.espaderarios.workers.dev`
3. Firewall/CORS not blocking requests

## Switching Back to Render (if needed)

If you need to revert to Render for both data and AI:

1. Update `getBackendUrl()` in `app.js` to return Render URL
2. Comment out D1 binding in `wrangler.toml`
3. Switch `handleFlashcardsD1` call to `handleFlashcards` in `index.js`

## Next Steps

- Monitor database usage in Cloudflare Dashboard
- Set up automated backups if needed
- Consider migrating to PostgreSQL for larger scale
- Add database indexes for common queries

## Support

For issues with:
- **D1 setup**: https://developers.cloudflare.com/d1/
- **Wrangler CLI**: https://developers.cloudflare.com/workers/wrangler/
- **Worker deployment**: Check `wrangler logs`
