# EcEClassroom Backend - Deploy Instructions

## Render.com Deployment Settings

**Root Directory:** `backend`

**Build Command:** `npm install`

**Start Command:** `node server.js`

**Environment Variables:**
```
GROQ_API_KEY=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
PORT=3000
NODE_ENV=production
APP_ORIGIN=https://classrio.me
```

## Important Notes
- Make sure you create a **Web Service**, not a **Static Site**
- Set **Root Directory** to `backend` (not empty or root)
- The backend will be available at: https://your-service-name.onrender.com
