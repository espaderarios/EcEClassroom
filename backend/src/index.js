const STORE = {
  classes: [],
  quizzes: []
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json;charset=UTF-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}

function parseIdFromPath(pathname) {
  const parts = pathname.split('/').filter(Boolean);
  return parts.length >= 3 ? parts[2] : null;
}

async function handleCollection(request, pathname, key) {
  const id = parseIdFromPath(pathname);
  if (request.method === 'GET') {
    if (id) {
      const item = STORE[key].find(i => i.id === id);
      return item ? jsonResponse(item) : jsonResponse({ error: 'Not found' }, 404);
    }
    return jsonResponse(STORE[key]);
  }

  if (request.method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const newItem = Object.assign({ id: `${key}_${Date.now()}_${Math.random().toString(36).slice(2,6)}` }, body);
    STORE[key].push(newItem);
    return jsonResponse(newItem, 201);
  }

  if ((request.method === 'PUT' || request.method === 'PATCH') && id) {
    const body = await request.json().catch(() => ({}));
    let found = false;
    STORE[key] = STORE[key].map(i => {
      if (i.id === id) {
        found = true;
        return Object.assign({}, i, body);
      }
      return i;
    });
    return found ? jsonResponse({ ok: true }) : jsonResponse({ error: 'Not found' }, 404);
  }

  if (request.method === 'DELETE' && id) {
    const before = STORE[key].length;
    STORE[key] = STORE[key].filter(i => i.id !== id);
    return before !== STORE[key].length ? jsonResponse({ ok: true }) : jsonResponse({ error: 'Not found' }, 404);
  }

  return jsonResponse({ error: 'Method not allowed' }, 405);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } });
    }

    try {
      if (pathname === '/' || pathname === '/health') {
        return jsonResponse({ ok: true, name: 'ec-eclassroom-backend' });
      }

        // AI-powered card generation (uses OpenAI key from environment)
        if (pathname === '/api/ai/generate' && request.method === 'POST') {
          const body = await request.json().catch(() => ({}));
          const prompt = body.prompt || body.text || 'Create flashcard Q&A pairs from this text.';
          const count = body.count || 5;

          if (!env || !env.OPENAI_API_KEY) {
            return jsonResponse({ error: 'AI key not configured. Set OPENAI_API_KEY via `wrangler secret put OPENAI_API_KEY`.' }, 400);
          }

          // Ask the model to produce JSON with an array of cards
          const system = `You are a helpful assistant that converts input text into flashcards. Reply with valid JSON of the form {"cards": [{"front":"...","back":"..."}, ...]}. Produce exactly ${count} cards when possible.`;

          const openaiResp = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${env.OPENAI_API_KEY}`
            },
            body: JSON.stringify({
              model: 'gpt-3.5-turbo',
              messages: [
                { role: 'system', content: system },
                { role: 'user', content: prompt }
              ],
              max_tokens: 800,
              temperature: 0.7
            })
          }).catch(err => null);

          if (!openaiResp) {
            return jsonResponse({ error: 'Error contacting AI provider' }, 502);
          }

          const openaiData = await openaiResp.json().catch(() => null);
          const text = openaiData?.choices?.[0]?.message?.content || '';

          try {
            // Try to parse model output as JSON
            const parsed = JSON.parse(text);
            if (Array.isArray(parsed.cards)) {
              // ensure ids
              const cards = parsed.cards.map((c, i) => ({ id: c.id || `card_${Date.now()}_${i}`, front: c.front || '', back: c.back || '' }));
              return jsonResponse({ cards });
            }
          } catch (e) {
            // fallthrough to fallback generator below
          }

          // Fallback: simple extraction if AI response isn't JSON
          const lines = text.split(/\r?\n/).filter(Boolean);
          const cards = [];
          for (let i = 0; i < Math.max(count, lines.length); i++) {
            const l = lines[i] || `Card ${i + 1}`;
            cards.push({ id: `card_${Date.now()}_${i}`, front: l.slice(0, 120), back: l.slice(0, 240) });
          }
          return jsonResponse({ cards });
        }

        // GROQ proxy: proxies queries to Sanity's HTTP API using a secret token
        if (pathname === '/api/groq' && request.method === 'POST') {
          const body = await request.json().catch(() => ({}));
          const { projectId, dataset = 'production', query, params } = body;

          if (!projectId || !query) {
            return jsonResponse({ error: 'projectId and query are required in body' }, 400);
          }

          if (!env || !env.SANITY_TOKEN) {
            return jsonResponse({ error: 'SANITY_TOKEN not configured. Use `wrangler secret put SANITY_TOKEN`.' }, 400);
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

          if (!forwardResp) return jsonResponse({ error: 'Error contacting Sanity' }, 502);

          const forwarded = await forwardResp.text().catch(() => null);
          try {
            return new Response(forwarded, { status: forwardResp.status, headers: { 'Content-Type': 'application/json' } });
          } catch (e) {
            return jsonResponse({ error: 'Invalid response from Sanity' }, 502);
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
          return jsonResponse({ cards });
        }

      if (pathname.startsWith('/api/classes')) {
        return handleCollection(request, pathname, 'classes');
      }

      if (pathname.startsWith('/api/quizzes')) {
        return handleCollection(request, pathname, 'quizzes');
      }

      return jsonResponse({ error: 'Not found' }, 404);
    } catch (err) {
      return jsonResponse({ error: err.message }, 500);
    }
  }
};
