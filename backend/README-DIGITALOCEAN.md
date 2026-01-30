# EClassroom Backend - DigitalOcean Ready

A production-ready Express backend for EClassroom with:
- ✅ File-based storage (upgrade to PostgreSQL for production)
- ✅ Google OAuth authentication
- ✅ AI flashcard generation (Gemini + OpenAI)
- ✅ Full CRUD API for flashcards, quizzes, classes
- ✅ CORS enabled
- ✅ No cold starts (always fast)

## Quick Start

### 1. Install Dependencies
```bash
cd backend
npm install --save express cors cookie-parser
```

### 2. Setup Environment
```bash
cp .env.example .env
nano .env  # Add your API keys
```

### 3. Run Locally
```bash
npm start
```

Visit: http://localhost:3000/health

### 4. Deploy to DigitalOcean

See [DIGITALOCEAN_DEPLOYMENT.md](../DIGITALOCEAN_DEPLOYMENT.md) for full instructions.

**Quick Deploy:**
1. Push to GitHub
2. Create App on DigitalOcean App Platform
3. Connect GitHub repo
4. Set environment variables
5. Deploy!

## API Endpoints

### Health
- `GET /health` - Health check

### Authentication
- `GET /auth/google/start` - Start Google OAuth flow
- `GET /auth/google/callback` - OAuth callback
- `POST /auth/link-google` - Link Google to local account

### Flashcards
- `GET /api/flashcards` - List all flashcards
- `GET /api/flashcards/:id` - Get flashcard by ID
- `POST /api/flashcards` - Create flashcard
- `PUT /api/flashcards/:id` - Update flashcard
- `DELETE /api/flashcards/:id` - Delete flashcard

### AI Generation
- `POST /api/generate-cards` - Generate flashcards with AI
  ```json
  {
    "topic": "photosynthesis",
    "count": 10
  }
  ```

### Quizzes
- `GET /api/quizzes` - List quizzes
- `POST /api/quizzes` - Create quiz
- `PUT /api/quizzes/:id` - Update quiz
- `DELETE /api/quizzes/:id` - Delete quiz

### Classes, Students, Teachers, Enrollments
- Similar CRUD endpoints for each resource

## Why DigitalOcean?

### Speed Comparison
- **Cloudflare Workers**: ~500-2000ms (cold start)
- **DigitalOcean**: ~50-200ms (always warm)
- **Gemini AI**: ~1-3 seconds (vs 5-10s on OpenAI)

### Cost
- $5-12/month for App Platform
- $6-12/month for Droplet
- Gemini API: **FREE** (60 req/min)

### Benefits
- ✅ No cold starts
- ✅ Persistent file storage
- ✅ Better debugging
- ✅ More control
- ✅ Easy scaling

## Storage

### Current: File-Based
- Data stored in `./data/*.json`
- Perfect for development/small scale
- Resets on App Platform redeployment

### Production: PostgreSQL (Recommended)
- Persistent storage
- Better performance
- ACID compliance
- Easy backup/restore

To upgrade:
```bash
npm install pg
# Update FileStorage class to use PostgreSQL
```

## Environment Variables

Required:
- `PORT` - Server port (default: 3000)
- `APP_ORIGIN` - Frontend URL for CORS

Optional (for features):
- `GEMINI_API_KEY` - For AI generation (recommended)
- `OPENAI_API_KEY` - Fallback AI provider
- `GOOGLE_CLIENT_ID` - Google OAuth
- `GOOGLE_CLIENT_SECRET` - Google OAuth
- `GOOGLE_REDIRECT_URI` - OAuth callback URL

## Development

```bash
# Install
npm install

# Run with auto-reload
npm run dev

# Run production mode
npm start
```

## Monitoring

### Logs
```bash
# App Platform: View in dashboard
# Droplet: pm2 logs

pm2 logs eclassroom-backend
```

### Metrics
- Response times
- Error rates
- Memory usage
- CPU usage

## Support

Issues? Check [DIGITALOCEAN_DEPLOYMENT.md](../DIGITALOCEAN_DEPLOYMENT.md) for troubleshooting.
