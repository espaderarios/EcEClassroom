# EClassroom

## Developer Portal

### Access
- Open: https://classrio.me/developer
- Or from the login screen, click **Developer Login**.

### Required Backend Secrets
Set these in the backend (Cloudflare Workers):
- `DEVELOPER_PASSWORD` (required)
- `DEVELOPER_TOKEN_SECRET` (recommended)

### What the Developer Portal Can Do
- View all public flashcard sets.
- Preview cards in a set.
- Delete a public set from the library.

### Notes
- If `/developer` returns 404, ensure the host serves `index.html` for SPA routes. This repo includes [_redirects](_redirects) to route `/developer` to `index.html`.
- The developer session expires after 2 hours; just log in again.
