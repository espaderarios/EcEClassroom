// Lightweight frontend client for the Cloudflare Worker backend (D1)
// Public browsing works without auth; mutations require bearer token.

const AUTH_TOKEN_KEY = "auth_token";

function getApiBase() {
  return localStorage.getItem("backendUrl") || "http://localhost:8787"; // Wrangler dev default
}

function setApiBase(url) {
  localStorage.setItem("backendUrl", url.replace(/\/$/, ""));
}

function getAuthToken() {
  return localStorage.getItem(AUTH_TOKEN_KEY) || null;
}

function setAuthToken(token) {
  if (token) localStorage.setItem(AUTH_TOKEN_KEY, token);
}

function clearAuthToken() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
}

async function apiRequest(path, { method = "GET", body, auth = false } = {}) {
  const headers = { "content-type": "application/json" };
  const token = getAuthToken();
  if (auth && token) headers["authorization"] = `Bearer ${token}`;

  const res = await fetch(`${getApiBase()}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error || `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data;
}

// Auth
async function register(email, password) {
  const data = await apiRequest("/auth/register", { method: "POST", body: { email, password } });
  if (data?.token) setAuthToken(data.token);
  return data;
}

async function login(email, password) {
  const data = await apiRequest("/auth/login", { method: "POST", body: { email, password } });
  if (data?.token) setAuthToken(data.token);
  return data;
}

function logout() {
  clearAuthToken();
}

// Sets (public)
async function listPublicSets() {
  return apiRequest("/sets?public=1");
}

// Sets (auth + public)
async function listSets() {
  return apiRequest("/sets", { auth: !!getAuthToken() });
}

async function getSet(id) {
  return apiRequest(`/sets/${id}`, { auth: !!getAuthToken() });
}

async function createSet(payload) {
  return apiRequest("/sets", { method: "POST", body: payload, auth: true });
}

async function updateSet(id, payload) {
  return apiRequest(`/sets/${id}`, { method: "PUT", body: payload, auth: true });
}

async function deleteSet(id) {
  return apiRequest(`/sets/${id}`, { method: "DELETE", auth: true });
}

async function upsertCards(setId, cards) {
  return apiRequest(`/sets/${setId}/cards`, { method: "PUT", body: { cards }, auth: true });
}

// Progress
async function saveProgress(setId, data) {
  return apiRequest(`/sets/${setId}/progress`, { method: "PUT", body: { data }, auth: true });
}

async function getProgress(setId) {
  return apiRequest(`/sets/${setId}/progress`, { method: "GET", auth: true });
}

// Utilities exposed on window for easy use in existing UI
window.ApiClient = {
  setApiBase,
  getApiBase,
  login,
  register,
  logout,
  listPublicSets,
  listSets,
  getSet,
  createSet,
  updateSet,
  deleteSet,
  upsertCards,
  saveProgress,
  getProgress,
  getToken: getAuthToken,
};
