// KV-based persistent storage helpers
function getCorsHeaders(origin = '*') {
  const allowedOrigin = origin && origin !== 'null' ? origin : '*';
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Origin, Accept',
    'Access-Control-Expose-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400'
  };
}

async function kvGet(kv, key) {
  const value = await kv.get(key);
  return value ? JSON.parse(value) : null;
}

async function kvGetAll(kv, prefix = '') {
  const list = await kv.list({ prefix });
  const items = [];
  for (const key of list.keys) {
    const value = await kv.get(key.name);
    if (value) items.push(JSON.parse(value));
  }
  return items;
}

async function kvPut(kv, key, value) {
  await kv.put(key, JSON.stringify(value));
}

async function kvDelete(kv, key) {
  await kv.delete(key);
}

function jsonResponse(data, status = 200, origin = '*') {
  const headers = getCorsHeaders(origin);
  headers['Content-Type'] = 'application/json;charset=UTF-8';

  return new Response(JSON.stringify(data), {
    status,
    headers
  });
}

function redirectResponse(location, { status = 302, cookies = [] } = {}) {
  const headers = new Headers({ Location: location });
  cookies.forEach(c => headers.append('Set-Cookie', c));
  return new Response(null, { status, headers });
}

function buildCookie(name, value, { httpOnly = true, secure = true, path = '/', sameSite = 'Lax', maxAge = 600 } = {}) {
  const parts = [`${name}=${value}`];
  if (path) parts.push(`Path=${path}`);
  if (httpOnly) parts.push('HttpOnly');
  if (secure) parts.push('Secure');
  if (sameSite) parts.push(`SameSite=${sameSite}`);
  if (maxAge) parts.push(`Max-Age=${maxAge}`);
  return parts.join('; ');
}

function getAppOrigin(env) {
  return env.APP_ORIGIN || 'https://classrio.me';
}

function parseIdFromPath(pathname) {
  const parts = pathname.split('/').filter(Boolean);
  return parts.length >= 3 ? parts[2] : null;
}

async function handleCollection(request, pathname, kv, origin = '*') {
  let id = null;
  try {
    if (!kv) {
      return jsonResponse({ error: 'KV namespace not available' }, 500, origin);
    }
    
    id = parseIdFromPath(pathname);
    
    if (request.method === 'GET') {
      if (id) {
        const item = await kvGet(kv, id);
        return item ? jsonResponse(item, 200, origin) : jsonResponse({ error: 'Not found' }, 404, origin);
      }
      const items = await kvGetAll(kv);
      return jsonResponse(items, 200, origin);
    }

    if (request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const itemId = body.id || `${Date.now()}_${Math.random().toString(36).slice(2,9)}`;
      const newItem = Object.assign({ id: itemId, createdAt: new Date().toISOString() }, body);
      await kvPut(kv, itemId, newItem);
      return jsonResponse(newItem, 201, origin);
    }

    if ((request.method === 'PUT' || request.method === 'PATCH') && id) {
      const existing = await kvGet(kv, id);
      if (!existing) {
        return jsonResponse({ error: 'Not found' }, 404, origin);
      }
      const body = await request.json().catch(() => ({}));
      const updated = Object.assign({}, existing, body, { updatedAt: new Date().toISOString() });
      await kvPut(kv, id, updated);
      return jsonResponse(updated, 200, origin);
    }

    if (request.method === 'DELETE' && id) {
      const existing = await kvGet(kv, id);
      if (!existing) {
        return jsonResponse({ error: 'Not found' }, 404, origin);
      }
      await kvDelete(kv, id);
      return jsonResponse({ ok: true }, 200, origin);
    }

    return jsonResponse({ error: 'Method not allowed' }, 405, origin);
  } catch (error) {
    console.error(`Collection handler error for ${pathname}:`, error);
    const message = error?.message || '';
    if (request.method === 'GET' && !id && message.includes('limit exceeded')) {
      return jsonResponse([], 200, origin);
    }
    return jsonResponse({ error: 'Storage operation failed', details: message || 'Unknown error' }, 500, origin);
  }
}

async function handleFlashcards(request, url, kv, origin = '*') {
  if (!kv) {
    return jsonResponse({ error: 'KV namespace not available' }, 500, origin);
  }

  const pathname = url.pathname;
  const id = parseIdFromPath(pathname);

  if (request.method === 'GET') {
    if (id) {
      const item = await kvGet(kv, id);
      return item ? jsonResponse(item, 200, origin) : jsonResponse({ error: 'Not found' }, 404, origin);
    }

    const userId = url.searchParams.get('userId') || url.searchParams.get('user_id');
    const items = await kvGetAll(kv);
    const filtered = userId ? items.filter(item => item && item.userId === userId) : items;
    return jsonResponse(filtered, 200, origin);
  }

  return handleCollection(request, pathname, kv, origin);
}

function buildLibrarySetKey(id) {
  return `library:set:${id}`;
}

function normalizeEmail(email = '') {
  return email.trim().toLowerCase();
}

function normalizeUsername(username = '') {
  return username.trim().toLowerCase();
}

function generateUserId() {
  return `user_${crypto.randomUUID()}`;
}

function generateSalt() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let binary = '';
  bytes.forEach(byte => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

async function hashPasswordWithSalt(password, salt) {
  const encoder = new TextEncoder();
  const payload = encoder.encode(`${salt}:${password}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', payload);
  return Array.from(new Uint8Array(hashBuffer))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}

function sanitizeAuthUser(user) {
  if (!user || typeof user !== 'object') {
    return null;
  }
  const { passwordHash, passwordSalt, normalizedEmail, normalizedUsername, ...safe } = user;
  return Object.assign({}, safe, { authenticated: true, provider: user.provider || 'local' });
}

async function handleLocalAuth(request, pathname, env, origin = '*') {
  if (!env || !env.STUDENTS) {
    return jsonResponse({ error: 'User storage is not configured' }, 500, origin);
  }

  const now = new Date().toISOString();

  if (pathname === '/api/auth/register' && request.method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const name = (body.name || '').trim();
    const username = (body.username || '').trim();
    const emailRaw = (body.email || '').trim();
    const password = typeof body.password === 'string' ? body.password : '';

    if (!name || !username || !emailRaw || !password) {
      return jsonResponse({ error: 'All fields are required' }, 400, origin);
    }

    if (password.length < 6) {
      return jsonResponse({ error: 'Password must be at least 6 characters' }, 400, origin);
    }

    const normalizedEmail = normalizeEmail(emailRaw);
    const normalizedUsername = normalizeUsername(username);
    const emailKey = `auth:email:${normalizedEmail}`;
    const usernameKey = `auth:username:${normalizedUsername}`;

    const existingByEmail = await kvGet(env.STUDENTS, emailKey);
    if (existingByEmail && existingByEmail.userId) {
      return jsonResponse({ error: 'Email is already registered' }, 409, origin);
    }

    const existingByUsername = await kvGet(env.STUDENTS, usernameKey);
    if (existingByUsername && existingByUsername.userId) {
      return jsonResponse({ error: 'Username is already taken' }, 409, origin);
    }

    const userId = generateUserId();
    const passwordSalt = generateSalt();
    const passwordHash = await hashPasswordWithSalt(password, passwordSalt);

    const userRecord = {
      id: userId,
      name,
      username,
      email: emailRaw,
      normalizedEmail,
      normalizedUsername,
      provider: 'local',
      createdAt: now,
      updatedAt: now,
      passwordSalt,
      passwordHash
    };

    await kvPut(env.STUDENTS, `auth:user:${userId}`, userRecord);
    await kvPut(env.STUDENTS, emailKey, { userId });
    await kvPut(env.STUDENTS, usernameKey, { userId });

    return jsonResponse({ user: sanitizeAuthUser(userRecord) }, 201, origin);
  }

  if (pathname === '/api/auth/login' && request.method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const identifierRaw = (body.identifier || body.email || body.username || '').trim();
    const password = typeof body.password === 'string' ? body.password : '';

    if (!identifierRaw || !password) {
      return jsonResponse({ error: 'Identifier and password are required' }, 400, origin);
    }

    const looksLikeEmail = identifierRaw.includes('@');
    const normalizedIdentifier = looksLikeEmail ? normalizeEmail(identifierRaw) : normalizeUsername(identifierRaw);
    const mappingKey = looksLikeEmail ? `auth:email:${normalizedIdentifier}` : `auth:username:${normalizedIdentifier}`;

    const mapping = await kvGet(env.STUDENTS, mappingKey);
    if (!mapping || !mapping.userId) {
      return jsonResponse({ error: 'Invalid credentials' }, 401, origin);
    }

    const storedUser = await kvGet(env.STUDENTS, `auth:user:${mapping.userId}`);
    if (!storedUser || !storedUser.passwordSalt || !storedUser.passwordHash) {
      return jsonResponse({ error: 'Invalid credentials' }, 401, origin);
    }

    const hashedAttempt = await hashPasswordWithSalt(password, storedUser.passwordSalt);
    if (hashedAttempt !== storedUser.passwordHash) {
      return jsonResponse({ error: 'Invalid credentials' }, 401, origin);
    }

    storedUser.updatedAt = now;
    await kvPut(env.STUDENTS, `auth:user:${storedUser.id}`, storedUser);

    return jsonResponse({ user: sanitizeAuthUser(storedUser) }, 200, origin);
  }

  return null;
}

function buildPublicOwnerKey(ownerId, ownerName) {
  const safeId = ownerId || ownerName || 'anonymous';
  return `public:${safeId}`;
}

function sanitizeLibrarySet(set, cards) {
  const cardList = Array.isArray(cards) ? cards : [];
  const sanitizedCards = cardList
    .map((card, index) => {
      if (!card) return null;
      const question = typeof card.question === 'string' ? card.question.trim() : '';
      const answer = typeof card.answer === 'string' ? card.answer.trim() : '';
      if (!question || !answer) return null;
      return {
        card_id: card.remote_card_id || card.card_id || card.id || `${Date.now()}_${index}`,
        question,
        answer,
        owner_id: card.owner_id || set.owner_id || '',
        owner_name: card.owner_name || set.owner_name || '',
        owner_email: card.owner_email || set.owner_email || '',
        owner_avatar: card.owner_avatar || set.owner_avatar || '',
        visibility: 'public'
      };
    })
    .filter(Boolean);

  const remoteSetId = set.remote_set_id || set.library_set_id || set.set_id || set.id || crypto.randomUUID();
  const ownerKey = buildPublicOwnerKey(set.owner_id, set.owner_name);
  const topic =
    typeof set.topic === 'string' && set.topic.trim()
      ? set.topic.trim()
      : typeof set.set_topic === 'string' && set.set_topic.trim()
        ? set.set_topic.trim()
        : '';

  return {
    remote_set_id: remoteSetId,
    set_id: remoteSetId,
    set_name: set.set_name || set.name || 'Untitled set',
    subject_name: set.subject_name || set.subject || '',
    topic,
    subject_icon: set.subject_icon || null,
    subject_id: set.subject_id || null,
    description: set.description || set.summary || '',
    tags: Array.isArray(set.tags) ? set.tags : [],
    owner_id: set.owner_id || '',
    owner_name: set.owner_name || set.owner || 'Community Creator',
    owner_email: set.owner_email || '',
    owner_avatar: set.owner_avatar || '',
    owner_key: ownerKey,
    visibility: 'public',
    card_count: sanitizedCards.length,
    cards: sanitizedCards,
    updated_at: new Date().toISOString(),
    source: 'community'
  };
}

function evaluateLibraryMatch(librarySet, term) {
  const needle = term.trim().toLowerCase();
  if (!needle) {
    return { matches: true, summary: '' };
  }

  const contains = value => (value || '').toLowerCase().includes(needle);

  if (contains(librarySet.set_name)) {
    return { matches: true, summary: 'Matches set title.' };
  }
  if (contains(librarySet.topic)) {
    return { matches: true, summary: 'Matches topic metadata.' };
  }
  if (contains(librarySet.subject_name)) {
    return { matches: true, summary: `Matches subject ${librarySet.subject_name}.` };
  }
  if (contains(librarySet.owner_name)) {
    return { matches: true, summary: 'Matches creator name.' };
  }
  if (contains(librarySet.description)) {
    return { matches: true, summary: 'Matches description.' };
  }
  if (Array.isArray(librarySet.tags) && librarySet.tags.some(tag => contains(tag))) {
    return { matches: true, summary: 'Matches tag.' };
  }
  if (Array.isArray(librarySet.cards)) {
    for (const card of librarySet.cards) {
      if (contains(card.question)) {
        return { matches: true, summary: 'Matches question text.' };
      }
      if (contains(card.answer)) {
        return { matches: true, summary: 'Matches answer text.' };
      }
    }
  }

  return { matches: false, summary: '' };
}

async function getAllPublishedSets(kv) {
  const list = await kv.list({ prefix: 'library:set:' });
  const results = [];
  for (const entry of list.keys) {
    const item = await kvGet(kv, entry.name);
    if (item && item.visibility === 'public') {
      results.push(item);
    }
  }
  return results;
}

function buildLibrarySearchResponse(sets, ownerFilter, term) {
  const usersMap = new Map();
  const normalizedSets = [];

  sets.forEach(set => {
    if (ownerFilter && set.owner_key !== ownerFilter) {
      return;
    }

    const { matches, summary } = evaluateLibraryMatch(set, term);
    if (!matches) {
      return;
    }

    const previewCards = Array.isArray(set.cards) ? set.cards.slice(0, 5) : [];

    normalizedSets.push({
      source: 'public',
      remote_set_id: set.remote_set_id,
      set_id: set.remote_set_id,
      set_name: set.set_name,
      subject_name: set.subject_name,
      topic: set.topic || '',
      subject_icon: set.subject_icon,
      owner_id: set.owner_id,
      owner_name: set.owner_name,
      owner_email: set.owner_email,
      owner_avatar: set.owner_avatar,
      owner_key: set.owner_key,
      visibility: set.visibility,
      description: set.description,
      tags: set.tags,
      card_count: set.card_count,
      matchSummary: summary,
      updated_at: set.updated_at,
      cards: previewCards
    });

    if (!usersMap.has(set.owner_key)) {
      usersMap.set(set.owner_key, {
        owner_key: set.owner_key,
        id: set.owner_id || set.owner_key,
        name: set.owner_name,
        email: set.owner_email,
        avatar: set.owner_avatar,
        source: 'public',
        setCount: 1
      });
    } else {
      const userEntry = usersMap.get(set.owner_key);
      userEntry.setCount += 1;
    }
  });

  return {
    users: Array.from(usersMap.values()),
    sets: normalizedSets
  };
}

async function handleLibraryEndpoint(request, url, env, origin = '*') {
  if (!env || !env.FLASHCARDS) {
    return jsonResponse({ error: 'Library storage is not configured' }, 500, origin);
  }

  const pathname = url.pathname;

  if (pathname === '/api/library/publish' && request.method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const setPayload = body.set || body;
    const cardsPayload = Array.isArray(body.cards) ? body.cards : [];

    if (!setPayload || typeof setPayload !== 'object') {
      return jsonResponse({ error: 'Missing set payload' }, 400, origin);
    }

    const sanitized = sanitizeLibrarySet(setPayload, cardsPayload);
    await kvPut(env.FLASHCARDS, buildLibrarySetKey(sanitized.remote_set_id), sanitized);

    return jsonResponse({ ok: true, remote_set_id: sanitized.remote_set_id, set: sanitized, owner_key: sanitized.owner_key }, 200, origin);
  }

  if (pathname === '/api/library/search' && request.method === 'GET') {
    const query = url.searchParams.get('query') || url.searchParams.get('q') || '';
    const ownerFilter = url.searchParams.get('ownerKey') || url.searchParams.get('owner') || '';
    const term = query.trim();

    if (term.length < 2 && !ownerFilter) {
      return jsonResponse({ users: [], sets: [] }, 200, origin);
    }

    const allSets = await getAllPublishedSets(env.FLASHCARDS);
    const response = buildLibrarySearchResponse(allSets, ownerFilter || null, term);
    return jsonResponse(response, 200, origin);
  }

  if (pathname.startsWith('/api/library/sets/')) {
    const remoteId = decodeURIComponent(pathname.split('/').pop() || '');
    if (!remoteId) {
      return jsonResponse({ error: 'Missing set identifier' }, 400, origin);
    }

    if (request.method === 'GET') {
      const stored = await kvGet(env.FLASHCARDS, buildLibrarySetKey(remoteId));
      if (!stored) {
        return jsonResponse({ error: 'Not found' }, 404, origin);
      }
      return jsonResponse({ set: stored, cards: stored.cards || [] }, 200, origin);
    }

    if (request.method === 'DELETE') {
      await kvDelete(env.FLASHCARDS, buildLibrarySetKey(remoteId));
      return jsonResponse({ ok: true }, 200, origin);
    }

    if (request.method === 'PUT' || request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const setPayload = body.set || body;
      const cardsPayload = Array.isArray(body.cards) ? body.cards : [];
      const sanitized = sanitizeLibrarySet({ ...setPayload, remote_set_id: remoteId }, cardsPayload);
      await kvPut(env.FLASHCARDS, buildLibrarySetKey(sanitized.remote_set_id), sanitized);
      return jsonResponse({ ok: true, remote_set_id: sanitized.remote_set_id, set: sanitized, owner_key: sanitized.owner_key }, 200, origin);
    }

    return jsonResponse({ error: 'Method not allowed' }, 405, origin);
  }

  if (pathname === '/api/library/unpublish' && request.method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const remoteId = body.remote_set_id || body.remoteSetId || body.id;
    if (!remoteId) {
      return jsonResponse({ error: 'Missing remote_set_id' }, 400, origin);
    }
    await kvDelete(env.FLASHCARDS, buildLibrarySetKey(remoteId));
    return jsonResponse({ ok: true }, 200, origin);
  }

  return jsonResponse({ error: 'Not found' }, 404, origin);
}

async function handleFlashcardSetsD1(request, url, env, origin = '*') {
  const { pathname, searchParams } = url;
  const userId = searchParams.get('userId');
  const idMatch = pathname.match(/\/api\/flashcard-sets\/([^/?]+)/);
  const setId = idMatch ? idMatch[1] : null;

  if (!env.DB) {
    return jsonResponse({ error: 'Database not available' }, 503, origin);
  }

  const db = env.DB;

  try {
    // GET /api/flashcard-sets - get all sets for user
    if (request.method === 'GET') {
      if (!userId) {
        return jsonResponse({ error: 'userId required' }, 400, origin);
      }

      if (setId) {
        // GET specific set
        const set = await db
          .prepare(`SELECT * FROM flashcard_sets WHERE id = ? AND user_id = ?`)
          .bind(setId, userId)
          .first();
        return jsonResponse(set || { error: 'Not found' }, set ? 200 : 404, origin);
      }

      // GET all sets
      const result = await db
        .prepare(`SELECT * FROM flashcard_sets WHERE user_id = ? ORDER BY created_at DESC`)
        .bind(userId)
        .all();
      return jsonResponse(result.results || [], 200, origin);
    }

    // POST /api/flashcard-sets - create new set
    if (request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const { name, subject } = body;

      if (!userId || !name) {
        return jsonResponse({ error: 'Missing required fields: userId, name' }, 400, origin);
      }

      // Auto-create the user if it doesn't exist (same as flashcards handler)
      try {
        const userExists = await db
          .prepare(`SELECT id FROM users WHERE id = ?`)
          .bind(userId)
          .first();

        if (!userExists) {
          const email = userId.startsWith('google_') 
            ? `${userId}@gmail.com` 
            : `${userId}@local.dev`;

          await db
            .prepare(
              `INSERT INTO users (id, email, name, provider, authenticated) 
               VALUES (?, ?, ?, ?, ?)`
            )
            .bind(userId, email, userId, userId.startsWith('google_') ? 'google' : 'local', 1)
            .run();
        }
      } catch (userError) {
        console.error('Error checking/creating user in sets handler:', userError);
      }

      const id = body.id || `set_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

      const result = await db
        .prepare(
          `INSERT INTO flashcard_sets (id, user_id, name, subject) 
           VALUES (?, ?, ?, ?)`
        )
        .bind(id, userId, name, subject || 'General')
        .run();

      if (!result.success) {
        return jsonResponse({ error: 'Failed to create set' }, 500, origin);
      }

      return jsonResponse({ id, user_id: userId, name, subject: subject || 'General' }, 201, origin);
    }

    // PUT /api/flashcard-sets/:id - update set
    if (request.method === 'PUT' && setId) {
      const body = await request.json().catch(() => ({}));
      const { name, subject } = body;

      if (!name) {
        return jsonResponse({ error: 'name required' }, 400, origin);
      }

      const result = await db
        .prepare(
          `UPDATE flashcard_sets 
           SET name = ?, subject = ?, updated_at = CURRENT_TIMESTAMP
           WHERE id = ? AND user_id = ?`
        )
        .bind(name, subject || 'General', setId, userId)
        .run();

      if (!result.success) {
        return jsonResponse({ error: 'Failed to update set' }, 500, origin);
      }

      return jsonResponse({ id: setId, user_id: userId, name, subject: subject || 'General' }, 200, origin);
    }

    // DELETE /api/flashcard-sets/:id - delete set
    if (request.method === 'DELETE' && setId) {
      const result = await db
        .prepare(`DELETE FROM flashcard_sets WHERE id = ? AND user_id = ?`)
        .bind(setId, userId)
        .run();

      if (!result.success) {
        return jsonResponse({ error: 'Failed to delete set' }, 500, origin);
      }

      return jsonResponse({ ok: true }, 200, origin);
    }

    return jsonResponse({ error: 'Method not allowed' }, 405, origin);
  } catch (error) {
    console.error('D1 flashcard sets error:', error);
    return jsonResponse({ error: error.message }, 500, origin);
  }
}

async function handleFlashcardsD1(request, url, env, origin = '*') {
  const { pathname, searchParams } = url;
  const userId = searchParams.get('userId');
  const setId = searchParams.get('setId');
  const idMatch = pathname.match(/\/api\/flashcards\/([^/?]+)/);
  const cardId = idMatch ? idMatch[1] : null;

  if (!env.DB) {
    return jsonResponse({ error: 'Database not available' }, 503, origin);
  }

  const db = env.DB;

  try {
    // GET /api/flashcards - get all cards for user
    if (request.method === 'GET') {
      if (!userId) {
        return jsonResponse({ error: 'userId required' }, 400, origin);
      }

      if (cardId) {
        // GET specific card
        const card = await db
          .prepare(`SELECT * FROM flashcards WHERE id = ? AND user_id = ?`)
          .bind(cardId, userId)
          .first();
        return jsonResponse(card || { error: 'Not found' }, card ? 200 : 404, origin);
      }

      // GET all cards, optionally filtered by setId
      let query = `SELECT * FROM flashcards WHERE user_id = ?`;
      const params = [userId];

      if (setId) {
        query += ` AND set_id = ?`;
        params.push(setId);
      }

      query += ` ORDER BY created_at DESC`;

      const result = await db.prepare(query).bind(...params).all();
      return jsonResponse(result.results || [], 200, origin);
    }

    // POST /api/flashcards - create new card
    if (request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      let { set_id, question, answer, type, set_name, subject_name } = body;

      // Handle undefined/null values with fallbacks
      set_id = set_id || body.setId || `set_${Date.now()}_auto`;
      question = question || body.front || 'Untitled question';
      answer = answer || body.back || 'Untitled answer';
      set_name = set_name || body.set_name || 'General Study Set';
      subject_name = subject_name || body.subject_name || 'General';

      // Better error reporting - show exactly what's missing
      const missing = [];
      if (!userId) missing.push('userId (query param)');
      if (!set_id || set_id === 'undefined' || set_id === 'null') missing.push('set_id');
      if (!question || question === 'undefined' || question === 'null') missing.push('question');
      if (!answer || answer === 'undefined' || answer === 'null') missing.push('answer');

      if (missing.length > 0) {
        return jsonResponse({ 
          error: 'Missing required fields', 
          missing: missing,
          received: { userId, set_id, question: question ? 'present' : 'missing', answer: answer ? 'present' : 'missing' }
        }, 400, origin);
      }

      // Auto-create the user if it doesn't exist
      try {
        const userExists = await db
          .prepare(`SELECT id FROM users WHERE id = ?`)
          .bind(userId)
          .first();

        if (!userExists) {
          // Extract email from userId if it's a Google user (google_XXX format)
          const email = userId.startsWith('google_') 
            ? `${userId}@gmail.com` 
            : `${userId}@local.dev`;

          const createUserResult = await db
            .prepare(
              `INSERT INTO users (id, email, name, provider, authenticated) 
               VALUES (?, ?, ?, ?, ?)`
            )
            .bind(userId, email, userId, userId.startsWith('google_') ? 'google' : 'local', 1)
            .run();

          if (!createUserResult.success) {
            console.error('Failed to auto-create user:', userId);
          }
        }
      } catch (userError) {
        console.error('Error checking/creating user:', userError);
        // Continue - set might still work if user already exists
      }

      // Auto-create the set if it doesn't exist
      try {
        const setExists = await db
          .prepare(`SELECT id FROM flashcard_sets WHERE id = ? AND user_id = ?`)
          .bind(set_id, userId)
          .first();

        if (!setExists) {
          // Create the set
          const createSetResult = await db
            .prepare(
              `INSERT INTO flashcard_sets (id, user_id, name, subject) 
               VALUES (?, ?, ?, ?)`
            )
            .bind(set_id, userId, set_name || 'Untitled Set', subject_name || 'General')
            .run();

          if (!createSetResult.success) {
            return jsonResponse({ error: 'Failed to create set' }, 500, origin);
          }
        }
      } catch (setError) {
        console.error('Error checking/creating set:', setError);
        return jsonResponse({ error: 'Failed to validate set' }, 500, origin);
      }

      const id = body.id || `card_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

      const result = await db
        .prepare(
          `INSERT INTO flashcards (id, user_id, set_id, question, answer) 
           VALUES (?, ?, ?, ?, ?)`
        )
        .bind(id, userId, set_id, question, answer)
        .run();

      if (!result.success) {
        return jsonResponse({ error: 'Failed to create card' }, 500, origin);
      }

      return jsonResponse({ id, user_id: userId, set_id, question, answer }, 201, origin);
    }

    // PUT /api/flashcards/:id - update card
    if (request.method === 'PUT' && cardId) {
      const body = await request.json().catch(() => ({}));
      const { question, answer } = body;

      if (!question || !answer) {
        return jsonResponse({ error: 'question and answer required' }, 400, origin);
      }

      const result = await db
        .prepare(
          `UPDATE flashcards 
           SET question = ?, answer = ?, updated_at = CURRENT_TIMESTAMP
           WHERE id = ? AND user_id = ?`
        )
        .bind(question, answer, cardId, userId)
        .run();

      if (!result.success) {
        return jsonResponse({ error: 'Failed to update card' }, 500, origin);
      }

      return jsonResponse({ id: cardId, user_id: userId, question, answer }, 200, origin);
    }

    // DELETE /api/flashcards/:id - delete card
    if (request.method === 'DELETE' && cardId) {
      const result = await db
        .prepare(`DELETE FROM flashcards WHERE id = ? AND user_id = ?`)
        .bind(cardId, userId)
        .run();

      if (!result.success) {
        return jsonResponse({ error: 'Failed to delete card' }, 500, origin);
      }

      return jsonResponse({ ok: true }, 200, origin);
    }

    return jsonResponse({ error: 'Method not allowed' }, 405, origin);
  } catch (error) {
    console.error('D1 flashcards error:', error);
    return jsonResponse({ error: error.message }, 500, origin);
  }
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('origin') || '*';
    const corsHeaders = getCorsHeaders(origin);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    try {
      const url = new URL(request.url);
      const pathname = url.pathname;

      if (pathname === '/' || pathname === '/health') {
        return jsonResponse({ ok: true, name: 'ec-eclassroom-backend' }, 200, origin);
      }

      if (pathname.startsWith('/api/auth/')) {
        const authResponse = await handleLocalAuth(request, pathname, env, origin);
        if (authResponse) {
          return authResponse;
        }
      }

      // --- Google OAuth: start ---
      if (pathname === '/auth/google/start' && request.method === 'GET') {
        const clientId = env.GOOGLE_CLIENT_ID;
        const clientSecret = env.GOOGLE_CLIENT_SECRET;
        if (!clientId || !clientSecret) {
          return jsonResponse({ error: 'Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.' }, 500, origin);
        }

        const url = new URL(request.url);
        const redirectUri = env.GOOGLE_REDIRECT_URI || `${url.origin}/auth/google/callback`;

        // CSRF state
        const state = crypto.randomUUID();
        const stateCookie = buildCookie('oauth_state', state, { maxAge: 600 });

        const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
        authUrl.searchParams.set('client_id', clientId);
        authUrl.searchParams.set('redirect_uri', redirectUri);
        authUrl.searchParams.set('response_type', 'code');
        authUrl.searchParams.set('scope', 'openid email profile');
        authUrl.searchParams.set('state', state);
        authUrl.searchParams.set('prompt', 'consent');

        return redirectResponse(authUrl.toString(), { cookies: [stateCookie] });
      }

      // --- Google OAuth: callback ---
      if (pathname === '/auth/google/callback' && request.method === 'GET') {
        const clientId = env.GOOGLE_CLIENT_ID;
        const clientSecret = env.GOOGLE_CLIENT_SECRET;
        if (!clientId || !clientSecret) {
          return jsonResponse({ error: 'Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.' }, 500, origin);
        }

        const url = new URL(request.url);
        const code = url.searchParams.get('code');
        const returnedState = url.searchParams.get('state');
        const redirectUri = env.GOOGLE_REDIRECT_URI || `${url.origin}/auth/google/callback`;

        const cookieHeader = request.headers.get('cookie') || '';
        const cookies = Object.fromEntries(cookieHeader.split(';').map(c => c.trim().split('=')));
        const savedState = cookies['oauth_state'];
        if (!code || !returnedState || !savedState || returnedState !== savedState) {
          return jsonResponse({ error: 'Invalid OAuth state or missing code' }, 400, origin);
        }

        // Exchange code for tokens
        const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri,
            grant_type: 'authorization_code'
          })
        });

        const tokenJson = await tokenResp.json().catch(() => null);
        if (!tokenResp.ok || !tokenJson || !tokenJson.access_token) {
          return jsonResponse({ error: 'Failed to exchange OAuth code' }, 400, origin);
        }

        // Get user info
        const userResp = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${tokenJson.access_token}` }
        });

        const userInfo = await userResp.json().catch(() => null);
        if (!userResp.ok || !userInfo || !userInfo.sub) {
          return jsonResponse({ error: 'Failed to fetch user profile' }, 400, origin);
        }

        // Build app user with Google account info
        const googleId = userInfo.sub;
        const appUserId = `google_${googleId}`;
        
        const appUser = {
          id: appUserId,
          provider: 'google',
          googleId: googleId,
          googleEmail: userInfo.email,
          email: userInfo.email,
          name: userInfo.name || userInfo.email || 'Google User',
          picture: userInfo.picture,
          createdAt: new Date().toISOString(),
          lastLogin: new Date().toISOString()
        };

        // Persist user (store in STUDENTS KV)
        if (env.STUDENTS) {
          // Check if user already exists
          const existingUser = await kvGet(env.STUDENTS, appUserId);
          if (existingUser) {
            // Update existing user
            appUser.createdAt = existingUser.createdAt;
            // Preserve any linked local user ID
            if (existingUser.linkedUserId) {
              appUser.linkedUserId = existingUser.linkedUserId;
            }
          }
          await kvPut(env.STUDENTS, appUserId, appUser);
          
          // Also store reverse mapping: googleId -> userId for quick lookups
          await kvPut(env.STUDENTS, `google_map_${googleId}`, { userId: appUserId, googleId, email: userInfo.email });
        }

        // Issue a lightweight session cookie with user id (for demo; replace with real session/JWT in production)
        const sessionPayload = encodeURIComponent(JSON.stringify({ id: appUser.id, name: appUser.name, email: appUser.email }));
        const sessionCookie = buildCookie('session_user', sessionPayload, { maxAge: 60 * 60 * 24 * 7 });

        // Also set a non-HttpOnly cookie so JavaScript can read the auth status
        const authFlagCookie = buildCookie('google_authenticated', 'true', { httpOnly: false, maxAge: 60 * 60 * 24 * 7 });

        const appOrigin = getAppOrigin(env);
        const redirectUrl = new URL(appOrigin);
        redirectUrl.searchParams.set('oauth_login', 'success');
        redirectUrl.searchParams.set('user_id', appUser.id);
        redirectUrl.searchParams.set('user_name', appUser.name);
        redirectUrl.searchParams.set('user_email', appUser.email);
        redirectUrl.searchParams.set('google_id', googleId);
        redirectUrl.searchParams.set('picture', appUser.picture || '');
        
        return redirectResponse(redirectUrl.toString(), { cookies: [sessionCookie, authFlagCookie, buildCookie('oauth_state', '', { maxAge: 0 })] });
      }

      // --- Link existing user to Google account ---
      if (pathname === '/auth/link-google' && request.method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const { localUserId, googleUserId } = body;
        
        if (!localUserId || !googleUserId) {
          return jsonResponse({ error: 'Both localUserId and googleUserId are required' }, 400, origin);
        }
        
        if (!env.STUDENTS) {
          return jsonResponse({ error: 'Storage not available' }, 500, origin);
        }
        
        // Get both users
        const localUser = await kvGet(env.STUDENTS, localUserId);
        const googleUser = await kvGet(env.STUDENTS, googleUserId);
        
        if (!googleUser) {
          return jsonResponse({ error: 'Google user not found' }, 404, origin);
        }
        
        // Link them
        if (localUser) {
          // Update local user with Google info
          localUser.googleId = googleUser.googleId;
          localUser.googleEmail = googleUser.googleEmail;
          localUser.linkedGoogleUserId = googleUserId;
          await kvPut(env.STUDENTS, localUserId, localUser);
        }
        
        // Update Google user with link to local user
        googleUser.linkedUserId = localUserId;
        await kvPut(env.STUDENTS, googleUserId, googleUser);
        
        return jsonResponse({ success: true, user: googleUser, linkedUser: localUser }, 200, origin);
      }

      // --- Get user by Google ID ---
      if (pathname.startsWith('/auth/user-by-google/') && request.method === 'GET') {
        const googleId = pathname.split('/').pop();
        
        if (!googleId || !env.STUDENTS) {
          return jsonResponse({ error: 'Invalid request' }, 400, origin);
        }
        
        const mapping = await kvGet(env.STUDENTS, `google_map_${googleId}`);
        if (!mapping) {
          return jsonResponse({ error: 'User not found' }, 404, origin);
        }
        
        const user = await kvGet(env.STUDENTS, mapping.userId);
        return jsonResponse({ user }, 200, origin);
      }

      // --- Developer password validation ---
      if (pathname === '/api/dev/validate' && request.method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const password = body.password || '';
        const devPassword = env.DEVELOPER_PASSWORD || 'dev123';

        if (password === devPassword) {
          return jsonResponse({ ok: true, valid: true, message: 'Developer mode activated' }, 200, origin);
        } else {
          return jsonResponse({ ok: false, valid: false, error: 'Invalid developer password' }, 401, origin);
        }
      }

      // --- Developer login endpoint ---
      if (pathname === '/api/developer/login' && request.method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const password = body.password || '';
        const devPassword = env.DEVELOPER_PASSWORD || 'dev123';

        if (password !== devPassword) {
          return jsonResponse({ ok: false, error: 'Invalid developer password' }, 401, origin);
        }

        // Generate a simple session token (in production, use proper JWT)
        const sessionToken = `dev_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
        
        return jsonResponse({ 
          ok: true, 
          authorized: true,
          sessionToken: sessionToken,
          message: 'Developer authenticated',
          backendUrl: 'https://ec-eclassroom-backend.espaderarios.workers.dev'
        }, 200, origin);
      }

      // --- Get all users for developer ---
      // --- Get all users for developer ---
      if (pathname === '/api/dev/users' && request.method === 'POST') {
        try {
          if (!env || !env.STUDENTS) {
            return jsonResponse({ ok: true, users: [] }, 200, origin);
          }

          const list = await env.STUDENTS.list();
          const users = [];

          for (const key of list.keys) {
            // Skip non-user keys (email mappings, google mappings, etc)
            if (key.name.startsWith('auth:user:')) {
              const value = await kvGet(env.STUDENTS, key.name);
              if (value && value.id) {
                // Get flashcard count for user
                let cardCount = 0;
                if (env.FLASHCARDS) {
                  const cardList = await env.FLASHCARDS.list({ prefix: `user:${value.id}:` });
                  cardCount = cardList.keys.length;
                }
                
                users.push({
                  id: value.id,
                  email: value.email,
                  username: value.username,
                  name: value.name,
                  role: value.role || 'student',
                  googleId: value.googleId || null,
                  createdAt: value.createdAt,
                  cardCount: cardCount,
                  lastLogin: value.lastLogin
                });
              }
            }
          }

          return jsonResponse({ ok: true, users: users.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)) }, 200, origin);
        } catch (err) {
          console.error('Error fetching users:', err);
          return jsonResponse({ ok: false, error: err.message }, 500, origin);
        }
      }

        // AI-powered card generation (uses Groq API key from environment)
        if (pathname === '/api/ai/generate' && request.method === 'POST') {
          const body = await request.json().catch(() => ({}));
          const topic = body.topic || '';
          const prompt = body.prompt || body.text || (topic ? `Create flashcard Q&A pairs about ${topic}.` : 'Create flashcard Q&A pairs from this text.');
          const parsedCount = Number.isFinite(Number(body.count)) ? Number(body.count) : 5;
          const count = Math.max(1, Math.min(20, Math.floor(parsedCount)));

          if (!env || !env.GROQ_API_KEY) {
            return jsonResponse({ error: 'AI key not configured. Set GROQ_API_KEY via `wrangler secret put GROQ_API_KEY`.' }, 400, origin);
          }

          const system = `You are a helpful assistant that converts study material into flashcards. Reply with valid JSON only: {"cards": [{"question":"Question text","answer":"Answer text"}]}. Create ${count} concise cards covering distinct points.`;

          const aiResp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${env.GROQ_API_KEY}`
            },
            body: JSON.stringify({
              model: 'llama-3.3-70b-versatile',
              messages: [
                { role: 'system', content: system },
                { role: 'user', content: prompt }
              ],
              temperature: 0.7,
              max_tokens: 800
            })
          }).catch(() => null);

          if (!aiResp) {
            console.error('[AI] Provider unreachable');
            return jsonResponse({ error: 'AI provider unreachable', details: 'Network error' }, 502, origin);
          }
          
          if (!aiResp.ok) {
            const errorBody = await aiResp.text().catch(() => '');
            console.error(`[AI] Provider returned ${aiResp.status}:`, errorBody);
            return jsonResponse({ 
              error: 'AI provider error', 
              status: aiResp.status,
              details: errorBody,
              model: 'llama-3.3-70b-versatile'
            }, 502, origin);
          }

          const aiData = await aiResp.json().catch(() => null);
          let text = aiData?.choices?.[0]?.message?.content || '';

          if (text.includes('```')) {
            const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
            if (fenced && fenced[1]) {
              text = fenced[1];
            }
          }

          try {
            // Try to parse model output as JSON
            const parsed = JSON.parse(text);
            if (Array.isArray(parsed.cards)) {
              const cards = parsed.cards.slice(0, 20).map((c, i) => {
                const questionRaw = typeof c.question === 'string' ? c.question.trim() : typeof c.front === 'string' ? c.front.trim() : '';
                const answerRaw = typeof c.answer === 'string' ? c.answer.trim() : typeof c.back === 'string' ? c.back.trim() : '';
                const questionClean = questionRaw && questionRaw.toLowerCase() !== 'undefined' ? questionRaw : '';
                const answerClean = answerRaw && answerRaw.toLowerCase() !== 'undefined' ? answerRaw : '';
                return {
                  id: c.id || `card_${Date.now()}_${i}`,
                  question: questionClean || `Question ${i + 1} about ${topic || 'the subject'}`,
                  answer: answerClean || `Key facts about ${topic || 'the subject'}.`
                };
              });
              return jsonResponse({ cards }, 200, origin);
            }
          } catch (e) {
            // fallthrough to fallback generator below
          }

          if (aiData?.error) {
            console.error('AI provider error', aiData.error);
            text = body.text || body.rawText || '';
          }

          const tryParseLooseJson = (value) => {
            if (!value || typeof value !== 'string') return null;
            let trimmed = value.trim();
            if (!trimmed) return null;
            trimmed = trimmed.replace(/,$/, '');
            try {
              return JSON.parse(trimmed);
            } catch (err) {
              return null;
            }
          };

          const coerceFromLine = (line) => {
            if (!line || typeof line !== 'string') return {};
            const parsed = tryParseLooseJson(line);
            if (parsed && typeof parsed === 'object') {
              return parsed;
            }

            const result = {};
            const questionMatch = line.match(/"(?:question|front|prompt)"\s*:\s*"([^\"]*)"/i);
            const answerMatch = line.match(/"(?:answer|back|response|explanation)"\s*:\s*"([^\"]*)"/i);
            if (questionMatch) {
              result.question = questionMatch[1];
            }
            if (answerMatch) {
              result.answer = answerMatch[1];
            }
            return result;
          };

          // Fallback: extract best-effort QA pairs from available text
          const userSource = [body.text, body.rawText, prompt]
            .find(value => typeof value === 'string' && value.trim().length > 0) || '';
          const fallbackSourceText = (userSource || text || '').trim();
          const sentences = fallbackSourceText
            .split(/(?<=[.!?])\s+/)
            .map(sentence => sentence.trim())
            .filter(sentence => sentence.length > 0 && !/^you didn't provide/i.test(sentence) && !/^i'm ready to help/i.test(sentence));
          const lines = sentences.length > 0 ? sentences : (fallbackSourceText ? [fallbackSourceText] : []);
          const cards = [];
          const fallbackCount = Math.max(1, Math.min(count, 20));

          // Always generate at least 'fallbackCount' cards, using topic as fallback if no text available
          for (let i = 0; i < fallbackCount; i++) {
            const rawLine = lines[i] && lines[i].toLowerCase() !== 'undefined' ? lines[i] : '';
            const extracted = coerceFromLine(rawLine);

            const questionText = (extracted.question || extracted.front || extracted.prompt || rawLine || `Question ${i + 1} about ${topic || 'the subject'}`).trim();
            const answerText = (extracted.answer || extracted.back || extracted.response || extracted.explanation || (rawLine ? rawLine.replace(/^Answer:\s*/i, '') : '') || `Key facts about ${topic || 'the subject'}.`).trim();

            // Ensure we always have valid cards, even if fields are empty
            cards.push({
              id: `card_${Date.now()}_${i}`,
              question: questionText || `Question ${i + 1} about ${topic || 'the subject'}`,
              answer: answerText || `Key facts about ${topic || 'the subject'}.`
            });
          }

          // Ensure we always return a valid response with cards array
          return jsonResponse({ cards: cards.slice(0, 20) }, 200, origin);
        }

        // AI-powered quiz generation (uses Groq API key from environment)
        if (pathname === '/api/ai/quiz' && request.method === 'POST') {
          const body = await request.json().catch(() => ({}));
          const topic = body.topic || 'General knowledge';
          const count = Math.max(1, Math.min(20, body.count || 5));

          if (!env || !env.GROQ_API_KEY) {
            return jsonResponse({ error: 'AI key not configured. Set GROQ_API_KEY via `wrangler secret put GROQ_API_KEY`.' }, 400, origin);
          }

          const systemPrompt = `You are a quiz generator. Generate multiple-choice quiz questions in strict JSON format.

CRITICAL: Do NOT include letter prefixes (A), B), C), D)) or numbers (1., 2.) in the option text.

Format: {"questions":[{"question":"What is X?","options":["First answer","Second answer","Third answer","Fourth answer"],"correct":"First answer"}]}

Rules:
- Provide exactly ${count} questions about ${topic}
- Each option should be JUST the answer text, no prefixes
- The "correct" field should be the EXACT TEXT of the correct option (not a letter)
- Options must be concise, distinct, and accurate
- Return ONLY valid JSON, no other text`;

          const aiResp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${env.GROQ_API_KEY}`
            },
            body: JSON.stringify({
              model: 'llama-3.3-70b-versatile',
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: topic }
              ],
              temperature: 0.7,
              max_tokens: 1200
            })
          }).catch(() => null);

          if (!aiResp) {
            return jsonResponse({ error: 'Error contacting AI provider' }, 502, origin);
          }

          const aiData = await aiResp.json().catch(() => null);

          let raw = aiData?.choices?.[0]?.message?.content || '';
          if (raw.includes('```')) {
            const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
            if (fenced && fenced[1]) {
              raw = fenced[1];
            }
          }

          try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed.questions) && parsed.questions.length) {
              return jsonResponse({ questions: parsed.questions.slice(0, count) }, 200, origin);
            }
          } catch (e) {
            console.error('Failed to parse AI response:', e.message);
          }

          if (aiData?.error) {
            console.error('AI provider error:', aiData.error);
          }

          // Fallback: synthesize simple questions if parsing failed
          const fallback = Array.from({ length: count }).map((_, i) => {
            const optionA = `${topic} - correct answer`;
            return {
              question: `Question ${i + 1} about ${topic}`,
              options: [
                optionA,
                `${topic} - distractor 1`,
                `${topic} - distractor 2`,
                `${topic} - distractor 3`
              ],
              correct: optionA
            };
          });

          return jsonResponse({ questions: fallback }, 200, origin);
        }

        // GROQ proxy: proxies queries to Sanity's HTTP API using a secret token
        if (pathname === '/api/groq' && request.method === 'POST') {
          const body = await request.json().catch(() => ({}));
          const { projectId, dataset = 'production', query, params } = body;

          if (!projectId || !query) {
            return jsonResponse({ error: 'projectId and query are required in body' }, 400, origin);
          }

          if (!env || !env.SANITY_TOKEN) {
            return jsonResponse({ error: 'SANITY_TOKEN not configured. Use `wrangler secret put SANITY_TOKEN`.' }, 400, origin);
          }

          const url = `https://${projectId}.api.sanity.io/v1/data/query/${dataset}`;

          const forwardResp = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${env.SANITY_TOKEN}`
            },
            body: JSON.stringify({ query, params })
          }).catch(e => null);

          if (!forwardResp) return jsonResponse({ error: 'Error contacting Sanity' }, 502, origin);

          const forwarded = await forwardResp.text().catch(() => null);
          try {
            const proxyHeaders = getCorsHeaders(origin);
            proxyHeaders['Content-Type'] = 'application/json;charset=UTF-8';
            return new Response(forwarded, { status: forwardResp.status, headers: proxyHeaders });
          } catch (e) {
            return jsonResponse({ error: 'Invalid response from Sanity' }, 502, origin);
          }
        }

        // Simple local mock generator (no AI)
        if (pathname === '/api/generate-cards' && request.method === 'POST') {
          const body = await request.json().catch(() => ({}));
          const text = body.text || body.prompt || 'Sample content about basic electronics: resistors, capacitors, circuits.';
          const count = body.count || 5;
          const parts = text.split(/[.?!]\s+/).filter(Boolean);
          const cards = [];
          for (let i = 0; i < count; i++) {
            const q = parts[i % parts.length] || `Question ${i + 1}`;
            const a = `Answer: ${q}`;
            cards.push({ id: `card_${Date.now()}_${i}`, front: q, back: a });
          }
          return jsonResponse({ cards }, 200, origin);
        }

      if (pathname.startsWith('/api/classes')) {
        return handleCollection(request, pathname, env.CLASSES, origin);
      }

      if (pathname.startsWith('/api/quizzes')) {
        return handleCollection(request, pathname, env.QUIZZES, origin);
      }

      if (pathname.startsWith('/api/students')) {
        return handleCollection(request, pathname, env.STUDENTS, origin);
      }

      if (pathname.startsWith('/api/teachers')) {
        return handleCollection(request, pathname, env.TEACHERS, origin);
      }

      if (pathname.startsWith('/api/enrollments')) {
        return handleCollection(request, pathname, env.ENROLLMENTS, origin);
      }

      if (pathname.startsWith('/api/attempts')) {
        return handleCollection(request, pathname, env.QUIZZES, origin);
      }

      if (pathname.startsWith('/api/library')) {
        return handleLibraryEndpoint(request, url, env, origin);
      }

      if (pathname.startsWith('/api/flashcard-sets')) {
        return handleFlashcardSetsD1(request, url, env, origin);
      }

      if (pathname.startsWith('/api/flashcards')) {
        return handleFlashcardsD1(request, url, env, origin);
      }

      return jsonResponse({ error: 'Not found' }, 404, origin);
    } catch (err) {
      console.error('Backend error:', err);
      const errorHeaders = getCorsHeaders(origin);
      errorHeaders['Content-Type'] = 'application/json;charset=UTF-8';
      return new Response(JSON.stringify({ error: err.message, stack: err.stack }), {
        status: 500,
        headers: errorHeaders
      });
    }
  }
};
