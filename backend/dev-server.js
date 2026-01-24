const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const PORT = process.env.PORT || 5000;

const STORE = { classes: [], quizzes: [] };

function jsonResponse(res, data, status = 200) {
  res.status(status).json(data);
}

app.get(['/', '/health'], (req, res) => {
  jsonResponse(res, { ok: true, name: 'ec-eclassroom-backend-dev' });
});

app.post('/api/generate-cards', (req, res) => {
  const body = req.body || {};
  const text = body.text || body.prompt || 'Sample content about basic electronics: resistors, capacitors, circuits.';
  const count = body.count || 5;
  const parts = text.split(/[.?!]\s+/).filter(Boolean);
  const cards = [];
  for (let i = 0; i < count; i++) {
    const q = parts[i % parts.length] || `Question ${i + 1}`;
    const a = `Answer: ${q}`;
    cards.push({ id: `card_${Date.now()}_${i}`, front: q, back: a });
  }
  jsonResponse(res, { cards });
});

app.post('/api/ai/generate', async (req, res) => {
  const body = req.body || {};
  const prompt = body.prompt || body.text || 'Create flashcard Q&A pairs from this text.';
  const count = body.count || 5;

  const key = process.env.GROQ_API_KEY;
  if (!key) return jsonResponse(res, { error: 'GROQ_API_KEY not configured' }, 400);

  try {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: 'meta-llama/llama-4-scout-17b-16e-instruct',
        messages: [
          { role: 'system', content: `Produce ${count} flashcards in JSON: {"cards":[{"front":"...","back":"..."}]}` },
          { role: 'user', content: prompt }
        ],
        max_tokens: 800,
        temperature: 0.7
      })
    });
    const data = await r.json();
    const raw = data?.choices?.[0]?.message?.content || '';
    const fenced = raw.match(/```json\s*([\s\S]*?)```/) || raw.match(/```\s*([\s\S]*?)```/) || [null, raw];
    const sourceText = fenced[1] || raw;

    try {
      const parsed = JSON.parse(sourceText);
      if (Array.isArray(parsed.cards)) return jsonResponse(res, { cards: parsed.cards });
    } catch (e) {
      // fallback below
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
      if (questionMatch) result.question = questionMatch[1];
      if (answerMatch) result.answer = answerMatch[1];
      return result;
    };

    const lines = sourceText.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    const fallbackCount = Math.max(count, lines.length || 1);
    const fallbackCards = [];

    for (let i = 0; i < fallbackCount; i++) {
      const rawLine = lines[i] ? lines[i] : '';
      const extracted = coerceFromLine(rawLine);
      const questionText = (extracted.question || extracted.front || extracted.prompt || rawLine || `Question ${i + 1}`).trim();
      const answerText = (extracted.answer || extracted.back || extracted.response || extracted.explanation || (rawLine ? rawLine.replace(/^Answer:\s*/i, '') : '') || `Answer for question ${i + 1}`).trim();

      fallbackCards.push({
        front: questionText || `Question ${i + 1}`,
        back: answerText || `Answer for question ${i + 1}`
      });
    }

    jsonResponse(res, { cards: fallbackCards });
  } catch (err) {
    jsonResponse(res, { error: err.message || String(err) }, 500);
  }
});

app.post('/api/groq', async (req, res) => {
  const { projectId, dataset = 'production', query, params } = req.body || {};
  if (!projectId || !query) return jsonResponse(res, { error: 'projectId and query required' }, 400);
  const token = process.env.SANITY_TOKEN;
  if (!token) return jsonResponse(res, { error: 'SANITY_TOKEN not configured' }, 400);

  try {
    const url = `https://${projectId}.api.sanity.io/v1/data/query/${dataset}`;
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ query, params }) });
    const text = await r.text();
    res.status(r.status).set('Content-Type', 'application/json').send(text);
  } catch (err) {
    jsonResponse(res, { error: err.message || String(err) }, 502);
  }
});

// Simple CRUD for classes and quizzes
app.get('/api/classes', (req, res) => jsonResponse(res, STORE.classes));
app.post('/api/classes', (req, res) => {
  const item = Object.assign({ id: `class_${Date.now()}` }, req.body || {});
  STORE.classes.push(item);
  jsonResponse(res, item, 201);
});

app.get('/api/quizzes', (req, res) => jsonResponse(res, STORE.quizzes));
app.post('/api/quizzes', (req, res) => {
  const item = Object.assign({ id: `quiz_${Date.now()}` }, req.body || {});
  STORE.quizzes.push(item);
  jsonResponse(res, item, 201);
});

app.listen(PORT, () => console.log(`Dev server listening on http://localhost:${PORT}`));
