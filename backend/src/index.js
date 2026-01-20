import { nanoid } from "./nanoid.js";

// Utility helpers
const jsonResponse = (data, init = {}) => {
  const headers = {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS",
    "access-control-allow-headers": "content-type, authorization",
    ...init.headers,
  };
  return new Response(JSON.stringify(data), { status: init.status || 200, headers });
};

const errorResponse = (message, status = 400) => jsonResponse({ error: message }, { status });

async function readJson(request) {
  try {
    return await request.json();
  } catch (err) {
    throw new Error("Invalid JSON body");
  }
}

// Auth helpers (HMAC JWT)
const encoder = new TextEncoder();

async function signJwt(payload, secret) {
  const header = { alg: "HS256", typ: "JWT" };
  const base64url = (input) => btoa(String.fromCharCode(...new Uint8Array(input))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

  const encodePart = (obj) => btoa(unescape(encodeURIComponent(JSON.stringify(obj)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const headerPart = encodePart(header);
  const payloadPart = encodePart(payload);
  const unsigned = `${headerPart}.${payloadPart}`;

  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(unsigned));
  const signature = base64url(sig);
  return `${unsigned}.${signature}`;
}

async function verifyJwt(token, secret) {
  try {
    const [headerB64, payloadB64, signature] = token.split(".");
    if (!headerB64 || !payloadB64 || !signature) return null;
    const unsigned = `${headerB64}.${payloadB64}`;
    const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
    const sigBytes = Uint8Array.from(atob(signature.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
    const ok = await crypto.subtle.verify("HMAC", key, sigBytes, encoder.encode(unsigned));
    if (!ok) return null;
    const payloadJson = decodeURIComponent(escape(atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/"))));
    const payload = JSON.parse(payloadJson);
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch (_) {
    return null;
  }
}

// Password helpers (PBKDF2)
async function hashPassword(password, salt = crypto.getRandomValues(new Uint8Array(16))) {
  const keyMaterial = await crypto.subtle.importKey("raw", encoder.encode(password), { name: "PBKDF2" }, false, ["deriveBits"]);
  const derived = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 120000, hash: "SHA-256" }, keyMaterial, 256);
  const hashBytes = new Uint8Array(derived);
  return {
    salt: btoa(String.fromCharCode(...salt)),
    hash: btoa(String.fromCharCode(...hashBytes)),
  };
}

async function verifyPassword(password, saltB64, hashB64) {
  const salt = Uint8Array.from(atob(saltB64), (c) => c.charCodeAt(0));
  const { hash } = await hashPassword(password, salt);
  return hash === hashB64;
}

// Database helpers
async function initSchema(db) {
  await db.exec(
    `CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        password_salt TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS sets (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        title TEXT NOT NULL,
        description TEXT DEFAULT "",
        is_public INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );
      CREATE TABLE IF NOT EXISTS cards (
        id TEXT PRIMARY KEY,
        set_id TEXT NOT NULL,
        question TEXT NOT NULL,
        answer TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (set_id) REFERENCES sets(id)
      );
      CREATE TABLE IF NOT EXISTS progress (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        set_id TEXT NOT NULL,
        data TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (set_id) REFERENCES sets(id)
      );`
  );
}

function withCors(handler) {
  return async (request, env, ctx) => {
    if (request.method === "OPTIONS") {
      return jsonResponse({}, { status: 204 });
    }
    return handler(request, env, ctx);
  };
}

function requireAuth(handler) {
  return async (request, env, ctx) => {
    const auth = request.headers.get("authorization");
    if (!auth?.startsWith("Bearer ")) return errorResponse("Unauthorized", 401);
    const token = auth.slice("Bearer ".length);
    const payload = await verifyJwt(token, env.JWT_SECRET);
    if (!payload) return errorResponse("Unauthorized", 401);
    request.user = { id: payload.sub, email: payload.email };
    return handler(request, env, ctx);
  };
}

async function handleAuthRegister(request, env) {
  const body = await readJson(request);
  const { email, password } = body;
  if (!email || !password) return errorResponse("Email and password required", 400);
  const existing = await env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(email).first();
  if (existing) return errorResponse("Email already registered", 409);

  const { salt, hash } = await hashPassword(password);
  const userId = nanoid();
  const now = new Date().toISOString();
  await env.DB.prepare("INSERT INTO users (id, email, password_hash, password_salt, created_at) VALUES (?, ?, ?, ?, ?)")
    .bind(userId, email, hash, salt, now)
    .run();
  const token = await signJwt({ sub: userId, email, exp: Date.now() + 1000 * 60 * 60 * 24 * 7 }, env.JWT_SECRET);
  return jsonResponse({ token, user: { id: userId, email } }, { status: 201 });
}

async function handleAuthLogin(request, env) {
  const body = await readJson(request);
  const { email, password } = body;
  if (!email || !password) return errorResponse("Email and password required", 400);
  const user = await env.DB.prepare("SELECT id, password_hash, password_salt FROM users WHERE email = ?").bind(email).first();
  if (!user) return errorResponse("Invalid credentials", 401);
  const ok = await verifyPassword(password, user.password_salt, user.password_hash);
  if (!ok) return errorResponse("Invalid credentials", 401);
  const token = await signJwt({ sub: user.id, email, exp: Date.now() + 1000 * 60 * 60 * 24 * 7 }, env.JWT_SECRET);
  return jsonResponse({ token, user: { id: user.id, email } });
}

async function handleGetSets(request, env) {
  const url = new URL(request.url);
  const onlyPublic = url.searchParams.get("public") === "1";
  const userId = request.user?.id;
  const rows = await env.DB.prepare(
    onlyPublic
      ? "SELECT * FROM sets WHERE is_public = 1 ORDER BY created_at DESC"
      : "SELECT * FROM sets WHERE user_id = ? OR is_public = 1 ORDER BY created_at DESC"
  )
    .bind(onlyPublic ? undefined : userId)
    .all();
  return jsonResponse({ sets: rows.results || [] });
}

async function handleCreateSet(request, env) {
  const body = await readJson(request);
  const { title, description = "", is_public = false, cards = [] } = body;
  if (!title) return errorResponse("Title is required", 400);
  const setId = nanoid();
  const now = new Date().toISOString();
  await env.DB.prepare(
    "INSERT INTO sets (id, user_id, title, description, is_public, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
  )
    .bind(setId, request.user.id, title, description, is_public ? 1 : 0, now, now)
    .run();

  for (const card of cards) {
    if (!card.question || !card.answer) continue;
    await env.DB.prepare(
      "INSERT INTO cards (id, set_id, question, answer, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
    )
      .bind(nanoid(), setId, card.question, card.answer, now, now)
      .run();
  }
  return jsonResponse({ id: setId }, { status: 201 });
}

async function handleGetSet(request, env, setId) {
  const set = await env.DB.prepare("SELECT * FROM sets WHERE id = ?").bind(setId).first();
  if (!set) return errorResponse("Not found", 404);
  if (!set.is_public && request.user?.id !== set.user_id) return errorResponse("Forbidden", 403);
  const cards = await env.DB.prepare("SELECT * FROM cards WHERE set_id = ? ORDER BY created_at ASC").bind(setId).all();
  return jsonResponse({ set, cards: cards.results || [] });
}

async function handleUpdateSet(request, env, setId) {
  const set = await env.DB.prepare("SELECT * FROM sets WHERE id = ?").bind(setId).first();
  if (!set) return errorResponse("Not found", 404);
  if (set.user_id !== request.user.id) return errorResponse("Forbidden", 403);
  const body = await readJson(request);
  const title = body.title ?? set.title;
  const description = body.description ?? set.description;
  const isPublic = body.is_public ?? !!set.is_public;
  const now = new Date().toISOString();
  await env.DB.prepare("UPDATE sets SET title = ?, description = ?, is_public = ?, updated_at = ? WHERE id = ?")
    .bind(title, description, isPublic ? 1 : 0, now, setId)
    .run();
  return jsonResponse({ ok: true });
}

async function handleDeleteSet(request, env, setId) {
  const set = await env.DB.prepare("SELECT * FROM sets WHERE id = ?").bind(setId).first();
  if (!set) return errorResponse("Not found", 404);
  if (set.user_id !== request.user.id) return errorResponse("Forbidden", 403);
  await env.DB.prepare("DELETE FROM cards WHERE set_id = ?").bind(setId).run();
  await env.DB.prepare("DELETE FROM sets WHERE id = ?").bind(setId).run();
  return jsonResponse({ ok: true });
}

async function handleUpsertCards(request, env, setId) {
  const set = await env.DB.prepare("SELECT * FROM sets WHERE id = ?").bind(setId).first();
  if (!set) return errorResponse("Not found", 404);
  if (set.user_id !== request.user.id) return errorResponse("Forbidden", 403);
  const body = await readJson(request);
  const { cards = [] } = body;
  const now = new Date().toISOString();
  for (const card of cards) {
    if (!card.question || !card.answer) continue;
    const cardId = card.id || nanoid();
    const existing = await env.DB.prepare("SELECT id FROM cards WHERE id = ?").bind(cardId).first();
    if (existing) {
      await env.DB.prepare("UPDATE cards SET question = ?, answer = ?, updated_at = ? WHERE id = ?")
        .bind(card.question, card.answer, now, cardId)
        .run();
    } else {
      await env.DB.prepare(
        "INSERT INTO cards (id, set_id, question, answer, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
      )
        .bind(cardId, setId, card.question, card.answer, now, now)
        .run();
    }
  }
  return jsonResponse({ ok: true });
}

async function handleSaveProgress(request, env, setId) {
  const body = await readJson(request);
  const { data } = body;
  if (!data) return errorResponse("Missing data", 400);
  const now = new Date().toISOString();
  const existing = await env.DB.prepare("SELECT id FROM progress WHERE user_id = ? AND set_id = ?")
    .bind(request.user.id, setId)
    .first();
  if (existing) {
    await env.DB.prepare("UPDATE progress SET data = ?, updated_at = ? WHERE id = ?")
      .bind(JSON.stringify(data), now, existing.id)
      .run();
  } else {
    await env.DB.prepare("INSERT INTO progress (id, user_id, set_id, data, updated_at) VALUES (?, ?, ?, ?, ?)")
      .bind(nanoid(), request.user.id, setId, JSON.stringify(data), now)
      .run();
  }
  return jsonResponse({ ok: true });
}

async function handleGetProgress(request, env, setId) {
  const row = await env.DB.prepare("SELECT data, updated_at FROM progress WHERE user_id = ? AND set_id = ?")
    .bind(request.user.id, setId)
    .first();
  if (!row) return jsonResponse({ data: null });
  return jsonResponse({ data: JSON.parse(row.data), updated_at: row.updated_at });
}

const router = async (request, env, ctx) => {
  if (!env.DB) return errorResponse("D1 binding missing", 500);
  if (request.method !== "OPTIONS") {
    await initSchema(env.DB);
  }

  const url = new URL(request.url);
  const path = url.pathname.replace(/\/$/, "");

  // Auth
  if (request.method === "POST" && path === "/auth/register") return handleAuthRegister(request, env);
  if (request.method === "POST" && path === "/auth/login") return handleAuthLogin(request, env);

  // Sets (public or auth-list)
  if (request.method === "GET" && path === "/sets") return handleGetSets(request, env);

  // Authenticated routes
  const authed = requireAuth(async (req, envInner) => {
    if (req.method === "POST" && path === "/sets") return handleCreateSet(req, envInner);
    const setMatch = path.match(/^\/sets\/([^/]+)$/);
    if (setMatch && req.method === "GET") return handleGetSet(req, envInner, setMatch[1]);
    if (setMatch && req.method === "PUT") return handleUpdateSet(req, envInner, setMatch[1]);
    if (setMatch && req.method === "DELETE") return handleDeleteSet(req, envInner, setMatch[1]);
    const cardsMatch = path.match(/^\/sets\/([^/]+)\/cards$/);
    if (cardsMatch && req.method === "PUT") return handleUpsertCards(req, envInner, cardsMatch[1]);
    const progressMatch = path.match(/^\/sets\/([^/]+)\/progress$/);
    if (progressMatch && req.method === "PUT") return handleSaveProgress(req, envInner, progressMatch[1]);
    if (progressMatch && req.method === "GET") return handleGetProgress(req, envInner, progressMatch[1]);
    return errorResponse("Not found", 404);
  });

  return authed(request, env, ctx);
};

export default { fetch: withCors(router) };
