# DigitalOcean Deployment Guide

## Quick Setup

### Option 1: DigitalOcean App Platform (Recommended - Easiest)

1. **Push to GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin YOUR_GITHUB_REPO_URL
   git push -u origin main
   ```

2. **Create App on DigitalOcean**
   - Go to https://cloud.digitalocean.com/apps
   - Click "Create App"
   - Connect your GitHub repository
   - Select the `backend` folder as the source directory
   - Choose "Web Service" type

3. **Configure Build & Run**
   - Build Command: `npm install`
   - Run Command: `npm start`
   - HTTP Port: `3000`
   - Environment Variables (add these):
     ```
     NODE_ENV=production
     PORT=3000
     APP_ORIGIN=https://your-frontend-url.com
     GOOGLE_CLIENT_ID=your_google_client_id
     GOOGLE_CLIENT_SECRET=your_google_client_secret
     GOOGLE_REDIRECT_URI=https://your-app-url.ondigitalocean.app/auth/google/callback
     GEMINI_API_KEY=your_gemini_api_key (optional, for AI generation)
     OPENAI_API_KEY=your_openai_api_key (optional, fallback for AI)
     ```

4. **Deploy**
   - Click "Create Resources"
   - Your app will be deployed at: `https://your-app-name.ondigitalocean.app`

5. **Update Frontend**
   - Update the backend URL in your frontend code to point to your DigitalOcean URL

### Option 2: DigitalOcean Droplet (VPS)

1. **Create Droplet**
   - Size: Basic $6/month (1GB RAM) or $12/month (2GB RAM recommended)
   - OS: Ubuntu 22.04 LTS
   - Add SSH key

2. **SSH into Droplet**
   ```bash
   ssh root@your-droplet-ip
   ```

3. **Install Node.js**
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs
   sudo apt-get install -y git
   ```

4. **Clone & Setup**
   ```bash
   cd /var/www
   git clone YOUR_REPO_URL
   cd YOUR_REPO/backend
   npm install
   ```

5. **Configure Environment**
   ```bash
   nano .env
   ```
   Add:
   ```
   PORT=3000
   NODE_ENV=production
   APP_ORIGIN=https://your-frontend-url.com
   GOOGLE_CLIENT_ID=your_google_client_id
   GOOGLE_CLIENT_SECRET=your_google_client_secret
   GOOGLE_REDIRECT_URI=http://your-droplet-ip:3000/auth/google/callback
   GEMINI_API_KEY=your_gemini_api_key
   ```

6. **Setup PM2 (Process Manager)**
   ```bash
   sudo npm install -g pm2
   pm2 start server.js --name "eclassroom-backend"
   pm2 save
   pm2 startup
   ```

7. **Setup Nginx (Reverse Proxy)**
   ```bash
   sudo apt-get install -y nginx
   sudo nano /etc/nginx/sites-available/eclassroom
   ```
   
   Add:
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;

       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
       }
   }
   ```

   Enable:
   ```bash
   sudo ln -s /etc/nginx/sites-available/eclassroom /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl restart nginx
   ```

8. **Setup SSL (Optional but Recommended)**
   ```bash
   sudo apt-get install -y certbot python3-certbot-nginx
   sudo certbot --nginx -d your-domain.com
   ```

### Option 3: Docker Deployment

1. **Create Dockerfile**
   ```dockerfile
   FROM node:20-alpine
   WORKDIR /app
   COPY package*.json ./
   RUN npm install --production
   COPY . .
   EXPOSE 3000
   CMD ["npm", "start"]
   ```

2. **Build & Run**
   ```bash
   docker build -t eclassroom-backend .
   docker run -d -p 3000:3000 \
     -e PORT=3000 \
     -e APP_ORIGIN=https://your-frontend.com \
     -e GEMINI_API_KEY=your_key \
     --name eclassroom-backend \
     eclassroom-backend
   ```

## Get API Keys

### Gemini API (Free, Recommended for AI Generation)
1. Go to https://makersuite.google.com/app/apikey
2. Create API key
3. Add to environment: `GEMINI_API_KEY=your_key`
4. Free tier: 60 requests/minute

### OpenAI API (Fallback)
1. Go to https://platform.openai.com/api-keys
2. Create API key
3. Add to environment: `OPENAI_API_KEY=your_key`
4. Pay-as-you-go pricing

### Google OAuth
1. Go to https://console.cloud.google.com/
2. Create project → APIs & Services → Credentials
3. Create OAuth 2.0 Client ID
4. Add authorized redirect URI: `https://your-backend-url/auth/google/callback`
5. Copy Client ID and Client Secret

## Update Frontend

Replace the backend URL in your frontend code:

**In `index.html`** (around line 200):
```javascript
const backendUrl = 'https://your-app.ondigitalocean.app';

function syncToBackend(item, method = 'POST') {
  // ... existing code ...
  const endpoint = method === 'DELETE' 
    ? `${backendUrl}/api/flashcards/${item.id}` 
    : `${backendUrl}/api/flashcards`;
  // ...
}

function loadFromBackend() {
  // ... existing code ...
  const response = await fetch(`${backendUrl}/api/flashcards`);
  // ...
}
```

**In `app.js`** (search for "AI_API_URL" around line 5821):
```javascript
const AI_API_URL = "https://your-app.ondigitalocean.app/api/generate-cards";
```

**In `app.js`** (search for "getBackendUrl" around line 5823):
```javascript
function getBackendUrl() {
  const stored = localStorage.getItem("backendUrl");
  if (stored && !stored.includes("localhost")) {
    return stored;
  }
  return "https://your-app.ondigitalocean.app";
}
```

## Testing

1. **Test backend health:**
   ```bash
   curl https://your-app.ondigitalocean.app/health
   ```

2. **Test AI generation:**
   ```bash
   curl -X POST https://your-app.ondigitalocean.app/api/generate-cards \
     -H "Content-Type: application/json" \
     -d '{"topic":"photosynthesis","count":3}'
   ```

## Costs

### App Platform
- Basic: $5/month (512MB RAM)
- Professional: $12/month (1GB RAM) ← Recommended

### Droplet
- Basic: $6/month (1GB RAM, 25GB SSD)
- Recommended: $12/month (2GB RAM, 50GB SSD)

### API Costs
- **Gemini:** FREE (60 req/min, 1500 req/day)
- **OpenAI GPT-3.5:** ~$0.002 per request

## Monitoring

### App Platform
- View logs: DigitalOcean Dashboard → Your App → Runtime Logs
- View metrics: Dashboard → Your App → Insights

### Droplet
```bash
# View PM2 logs
pm2 logs eclassroom-backend

# View PM2 status
pm2 status

# Restart app
pm2 restart eclassroom-backend
```

## Troubleshooting

### "ENOENT: no such file or directory" error
- The app will auto-create the `data` folder on first run
- For persistent storage on App Platform, consider upgrading to use PostgreSQL

### CORS errors
- Make sure `APP_ORIGIN` matches your frontend URL exactly
- Include protocol: `https://` not just domain

### AI generation slow
- Gemini is typically faster than OpenAI
- Consider caching responses for common topics
- Increase timeout if needed

### Data not persisting
- App Platform: Data resets on redeploy (use PostgreSQL for production)
- Droplet: Data persists in `/var/www/YOUR_REPO/backend/data`

## Upgrade to PostgreSQL (Production Recommended)

For production use with App Platform, upgrade to PostgreSQL:

1. **Add Database**
   - DigitalOcean Dashboard → Databases → Create
   - Choose PostgreSQL
   - $15/month for 1GB RAM

2. **Update code to use PostgreSQL instead of file storage**
   - Install: `npm install pg`
   - Replace FileStorage class with PostgreSQL queries

## Why DigitalOcean is Faster

- **Gemini API**: 10-30x faster than OpenAI
- **Dedicated server**: No cold starts (unlike serverless)
- **Better latency**: Closer to users than Render free tier
- **Persistent connections**: Faster database queries
