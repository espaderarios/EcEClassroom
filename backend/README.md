# EcEClassroom Cloudflare Worker Backend

A minimal Cloudflare Worker + D1 API to support authenticated saving while allowing anonymous browsing.

## Features
- Users: register/login with JWT (HS256) and PBKDF2 password hashing.
- Flashcard sets: list public sets; auth users can create/update/delete their own sets and cards.
- Progress: auth users can save per-set progress blobs.
- CORS enabled for browser calls.

## API (JSON)
Base path: `/`

Auth
- `POST /auth/register` { email, password }
- `POST /auth/login` { email, password }

Sets (public + personal)
- `GET /sets?public=1` list public sets
- `GET /sets` list public + your sets (if auth header present)
- `POST /sets` (auth) { title, description?, is_public?, cards?: [{question,answer}] }
- `GET /sets/:id` (public if set.is_public, otherwise auth owner)
- `PUT /sets/:id` (auth owner) { title?, description?, is_public? }
- `DELETE /sets/:id` (auth owner)
- `PUT /sets/:id/cards` (auth owner) { cards: [{ id?, question, answer }] } upsert by id

Progress (auth)
- `PUT /sets/:id/progress` { data }
- `GET /sets/:id/progress`

Auth header: `Authorization: Bearer <token>`

## Local dev
1) Install deps: `npm install`
2) Create D1 DB: `npx wrangler d1 create ec_classroom_db` and copy `database_id` into `wrangler.toml`.
3) Run migrations: `npx wrangler d1 migrations apply ec_classroom_db --local` or `wrangler d1 execute` using `migrations/0001_init.sql`.
4) Set secret: `npx wrangler secret put JWT_SECRET`.
5) Dev server: `npm run dev`

## Deploy
- `npm run deploy`
- Ensure `JWT_SECRET` secret and D1 binding exist in the deployed environment.

## Notes
- Passwords use PBKDF2-SHA256 (120k iterations) with per-user salt.
- JWT expiry: 7 days (`exp`).
- CORS is open (`*`). Harden in production if needed.
