// KV-based persistent storage helpers
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

async function handleCollection(request, pathname, kv) {
  const id = parseIdFromPath(pathname);
  
  if (request.method === 'GET') {
    if (id) {
      const item = await kvGet(kv, id);
      return item ? jsonResponse(item) : jsonResponse({ error: 'Not found' }, 404);
    }
    const items = await kvGetAll(kv);
    return jsonResponse(items);
  }

  if (request.method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const itemId = body.id || `${Date.now()}_${Math.random().toString(36).slice(2,9)}`;
    const newItem = Object.assign({ id: itemId, createdAt: new Date().toISOString() }, body);
    await kvPut(kv, itemId, newItem);
    return jsonResponse(newItem, 201);
  }

  if ((request.method === 'PUT' || request.method === 'PATCH') && id) {
    const existing = await kvGet(kv, id);
    if (!existing) {
      return jsonResponse({ error: 'Not found' }, 404);
    }
    const body = await request.json().catch(() => ({}));
    const updated = Object.assign({}, existing, body, { updatedAt: new Date().toISOString() });
    await kvPut(kv, id, updated);
    return jsonResponse(updated);
  }

  if (request.method === 'DELETE' && id) {
    const existing = await kvGet(kv, id);
    if (!existing) {
      return jsonResponse({ error: 'Not found' }, 404);
    }
    await kvDelete(kv, id);
    return jsonResponse({ ok: true });
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

        // AI-powered quiz generation (uses Groq API key from environment)
        if (pathname === '/api/ai/quiz' && request.method === 'POST') {
          const body = await request.json().catch(() => ({}));
          const topic = body.topic || 'General knowledge';
          const count = Math.max(1, Math.min(20, body.count || 5));

          if (!env || !env.OPENAI_API_KEY) {
            return jsonResponse({ error: 'AI key not configured. Set OPENAI_API_KEY via `wrangler secret put OPENAI_API_KEY`.' }, 400);
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
              'Authorization': `Bearer ${env.OPENAI_API_KEY}`
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
            return jsonResponse({ error: 'Error contacting AI provider' }, 502);
          }

          const aiData = await aiResp.json().catch(() => null);
          
          // Debug logging
          console.log('AI Response Status:', aiResp.status);
          console.log('AI Data:', JSON.stringify(aiData));
          
          const raw = aiData?.choices?.[0]?.message?.content || '';
          console.log('Raw AI content:', raw);

          try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed.questions) && parsed.questions.length) {
              return jsonResponse({ questions: parsed.questions.slice(0, count) });
            }
          } catch (e) {
            console.error('Failed to parse AI response:', e.message);
            // Check if API returned an error
            if (aiData?.error) {
              return jsonResponse({ error: `AI API error: ${aiData.error.message || JSON.stringify(aiData.error)}` }, 500);
            }
            // fall through to fallback
          }

          // Fallback: synthesize simple questions if parsing failed
          const fallback = Array.from({ length: count }).map((_, i) => {
            return {
              question: `Question ${i + 1} about ${topic}`,
              options: [
                `${topic} - correct answer`,
                `${topic} - distractor 1`,
                `${topic} - distractor 2`,
                `${topic} - distractor 3`
              ],
              correct: 'A'
            };
          });

          return jsonResponse({ questions: fallback });
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
        return handleCollection(request, pathname, env.CLASSES);
      }

      if (pathname.startsWith('/api/quizzes')) {
        return handleCollection(request, pathname, env.QUIZZES);
      }

      if (pathname.startsWith('/api/students')) {
        return handleCollection(request, pathname, env.STUDENTS);
      }

      if (pathname.startsWith('/api/teachers')) {
        return handleCollection(request, pathname, env.TEACHERS);
      }

      if (pathname.startsWith('/api/enrollments')) {
        return handleCollection(request, pathname, env.ENROLLMENTS);
      }

      if (pathname.startsWith('/api/attempts')) {
        return handleCollection(request, pathname, env.QUIZZES);
      }

      return jsonResponse({ error: 'Not found' }, 404);
    } catch (err) {
      return jsonResponse({ error: err.message }, 500);
    }
  }
};
