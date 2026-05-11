# 🚀 Auto-Deployment Setup Guide

Your website will now automatically update whenever you push code to GitHub. Follow these steps to configure it:

## Step 1: Push Your Code to GitHub

```powershell
cd c:\Users\User\VScoderios\flashcard\EcEClassroom

# Initialize git if not already done
git init

# Add GitHub remote
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git

# Push to GitHub
git add .
git commit -m "Set up auto-deployment"
git push -u origin main
```

## Step 2: Configure GitHub Secrets

Go to: `https://github.com/YOUR_USERNAME/YOUR_REPO_NAME/settings/secrets/actions`

Add these secrets based on where you want to deploy:

### Option A: Deploy Backend to Render.com

1. Go to https://render.com/dashboard
2. Find your web service
3. Click "Settings" → "Deploy Hook"
4. Copy the deploy URL
5. On GitHub, add secret: `RENDER_DEPLOY_HOOK` = `<your-render-deploy-hook-url>`

**Example:**
```
https://api.render.com/deploy/srv-abc123def456?key=xyz...
```

### Option B: Deploy Frontend to Netlify

1. Go to https://app.netlify.com/user/applications#personal-access-tokens
2. Create a new Personal access token
3. Go to Site settings → General → Site name (note your site ID)
4. On GitHub, add these secrets:
   - `NETLIFY_AUTH_TOKEN` = `<your-netlify-token>`
   - `NETLIFY_SITE_ID` = `<your-site-id>`

### Option C: Deploy to Cloudflare Pages

1. Go to https://dash.cloudflare.com/
2. Navigate to: Workers & Pages → Pages → Your Site
3. Settings → Build & deployments → API Token
4. On GitHub, add these secrets:
   - `CLOUDFLARE_API_TOKEN` = `<your-api-token>`
   - `CLOUDFLARE_ACCOUNT_ID` = `<your-account-id>`

## Step 3: Test Auto-Deployment

Make a small change to your code and commit:

```powershell
# Make a change to any file, e.g., edit app.js
git add .
git commit -m "Test auto-deployment"
git push
```

Then:
1. Go to: `https://github.com/YOUR_USERNAME/YOUR_REPO_NAME/actions`
2. Watch the workflow run
3. When it completes (✅ green), your changes are live!

## Step 4: Verify Deployment

- **Backend**: Check https://your-service-name.onrender.com (or your Render URL)
- **Frontend**: Check your Netlify or Cloudflare Pages URL

---

## How It Works

Every time you:
1. Make changes locally
2. Commit with `git commit`
3. Push with `git push`

The workflow automatically:
- ✅ Checks out your code
- ✅ Installs dependencies
- ✅ Deploys backend (if configured)
- ✅ Deploys frontend (if configured)
- ✅ Sends you updates via GitHub

---

## Troubleshooting

**Q: Deployment failed in GitHub Actions?**
- Check the workflow logs: Actions → Failed workflow → View logs
- Common issues: Missing secrets, wrong tokens, incorrect configuration

**Q: Which platform should I use?**
- **Render.com**: Best for Node.js backend, automatic GitHub integration
- **Netlify**: Great for static frontend, very user-friendly
- **Cloudflare Pages**: Excellent for global edge deployment

**Q: Do I need all three platforms?**
- No! Pick one or two:
  - Backend: Use Render.com
  - Frontend: Use Netlify or Cloudflare Pages

**Q: Can I deploy both frontend and backend?**
- Yes! The workflow supports both. Just configure the secrets you need.

---

## Alternative: Deploy Backend to DigitalOcean (Automatic)

If using DigitalOcean App Platform:
1. Go to https://cloud.digitalocean.com/apps
2. Connect your GitHub repository
3. DigitalOcean will automatically deploy on every push (no manual config needed!)

---

## Next Steps

Once configured, you can:
- Make changes anytime
- Push to GitHub
- Your site updates automatically! 🚀

No more manual deployments needed!
