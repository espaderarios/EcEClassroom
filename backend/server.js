const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const fs = require('fs').promises;
const path = require('path');

// Load environment variables from .env file
require('dotenv').config();

const app = express();
const allowedOrigins = (process.env.ALLOWED_ORIGINS || process.env.APP_ORIGIN || 'https://classrio.me,http://localhost:3000,http://127.0.0.1:3000')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));

const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');

// Ensure data directory exists
async function ensureDataDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch (err) {
    console.error('Failed to create data directory:', err);
  }
}

// Simple file-based storage (replace with PostgreSQL/MongoDB for production)
class FileStorage {
  constructor(collection) {
    this.collection = collection;
    this.filePath = path.join(DATA_DIR, `${collection}.json`);
    this.writeQueue = Promise.resolve();
  }

  async readAll() {
    try {
      const data = await fs.readFile(this.filePath, 'utf8');
      return JSON.parse(data);
    } catch (err) {
      if (err.code === 'ENOENT') return [];
      throw err;
    }
  }

  async writeAll(data) {
    const tempPath = `${this.filePath}.tmp`;
    const payload = JSON.stringify(data, null, 2);

    this.writeQueue = this.writeQueue.then(async () => {
      await fs.writeFile(tempPath, payload, 'utf8');
      await fs.rename(tempPath, this.filePath);
    });

    await this.writeQueue;
  }

  async getAll(filter = {}) {
    const items = await this.readAll();
    if (Object.keys(filter).length === 0) return items;
    
    return items.filter(item => {
      return Object.entries(filter).every(([key, value]) => item[key] === value);
    });
  }

  async get(id) {
    const items = await this.readAll();
    return items.find(item => item.id === id) || null;
  }

  async create(data) {
    const items = await this.readAll();
    const id = data.id || `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const newItem = {
      ...data,
      id,
      createdAt: data.createdAt || new Date().toISOString()
    };
    items.push(newItem);
    await this.writeAll(items);
    return newItem;
  }

  async update(id, data) {
    const items = await this.readAll();
    const index = items.findIndex(item => item.id === id);
    if (index === -1) return null;
    
    items[index] = {
      ...items[index],
      ...data,
      id,
      updatedAt: new Date().toISOString()
    };
    await this.writeAll(items);
    return items[index];
  }

  async delete(id) {
    const items = await this.readAll();
    const filtered = items.filter(item => item.id !== id);
    if (filtered.length === items.length) return false;
    
    await this.writeAll(filtered);
    return true;
  }
}

function getAuthenticatedUserId(req) {
  const isAuthed = req.cookies?.google_authenticated === 'true';
  if (!isAuthed) return null;
  return req.cookies?.auth_user_id || null;
}

function requireApiAuth(req, res, next) {
  const userId = getAuthenticatedUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  req.authUserId = String(userId);
  next();
}

function ensureOwnerScope(item, ownerField, authUserId) {
  if (!item || !ownerField) return false;
  const value = item[ownerField];
  if (!value) return false;
  return String(value) === String(authUserId);
}

// Storage instances
const stores = {
  classes: new FileStorage('classes'),
  quizzes: new FileStorage('quizzes'),
  students: new FileStorage('students'),
  teachers: new FileStorage('teachers'),
  enrollments: new FileStorage('enrollments'),
  flashcards: new FileStorage('flashcards')
};

// Generic CRUD handler
function createCRUDRoutes(app, path, store, options = {}) {
  const ownerField = options.ownerField || null;
  const lockToOwner = Boolean(ownerField);

  // Get all or by ID
  app.get(`${path}/:id?`, requireApiAuth, async (req, res) => {
    try {
      if (req.params.id) {
        const item = await store.get(req.params.id);
        if (!item) return res.status(404).json({ error: 'Not found' });
        if (lockToOwner && !ensureOwnerScope(item, ownerField, req.authUserId)) {
          return res.status(403).json({ error: 'Forbidden' });
        }
        return res.json(item);
      }

      const filter = { ...req.query };
      if (lockToOwner) {
        filter[ownerField] = req.authUserId;
      }

      const items = await store.getAll(filter);
      res.json(items);
    } catch (err) {
      console.error(`GET ${path} error:`, err);
      res.status(500).json({ error: 'Server error', details: err.message });
    }
  });

  // Create
  app.post(path, requireApiAuth, async (req, res) => {
    try {
      const payload = { ...req.body };
      if (lockToOwner) {
        payload[ownerField] = req.authUserId;
      }
      const item = await store.create(payload);
      res.status(201).json(item);
    } catch (err) {
      console.error(`POST ${path} error:`, err);
      res.status(500).json({ error: 'Server error', details: err.message });
    }
  });

  // Update
  app.put(`${path}/:id`, requireApiAuth, async (req, res) => {
    try {
      const existing = await store.get(req.params.id);
      if (!existing) return res.status(404).json({ error: 'Not found' });
      if (lockToOwner && !ensureOwnerScope(existing, ownerField, req.authUserId)) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const payload = { ...req.body };
      if (lockToOwner) {
        payload[ownerField] = req.authUserId;
      }
      const item = await store.update(req.params.id, payload);
      res.json(item);
    }
    catch (err) {
      console.error(`PUT ${path} error:`, err);
      res.status(500).json({ error: 'Server error', details: err.message });
    }
  });

  // Delete
  app.delete(`${path}/:id`, requireApiAuth, async (req, res) => {
    try {
      const existing = await store.get(req.params.id);
      if (!existing) return res.status(404).json({ error: 'Not found' });
      if (lockToOwner && !ensureOwnerScope(existing, ownerField, req.authUserId)) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const deleted = await store.delete(req.params.id);
      if (!deleted) return res.status(404).json({ error: 'Not found' });
      res.json({ ok: true });
    } catch (err) {
      console.error(`DELETE ${path} error:`, err);
      res.status(500).json({ error: 'Server error', details: err.message });
    }
  });
}

// Health check
app.get(['/', '/health'], (req, res) => {
  res.json({ ok: true, name: 'ec-eclassroom-backend', version: '2.0.0' });
});

// Google OAuth routes
app.get('/auth/google/start', (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  
  if (!clientId || !clientSecret) {
    return res.status(500).json({ 
      error: 'Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.' 
    });
  }

  const redirectUri = process.env.GOOGLE_REDIRECT_URI || 
    `${req.protocol}://${req.get('host')}/auth/google/callback`;
  
  const state = Buffer.from(JSON.stringify({ 
    timestamp: Date.now(), 
    random: Math.random() 
  })).toString('base64');
  
  res.cookie('oauth_state', state, { 
    httpOnly: true, 
    secure: req.secure,
    maxAge: 600000 // 10 minutes
  });

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', 'openid email profile');
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('prompt', 'consent');

  res.redirect(authUrl.toString());
});

app.get('/auth/google/callback', async (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const appOrigin = process.env.APP_ORIGIN || 'https://classrio.me';
  
  if (!clientId || !clientSecret) {
    return res.status(500).json({ error: 'Google OAuth not configured' });
  }

  const { code, state } = req.query;
  const savedState = req.cookies?.oauth_state;

  if (!code || !state || !savedState || state !== savedState) {
    return res.redirect(`${appOrigin}/?oauth_login=error&error=invalid_state`);
  }

  const redirectUri = process.env.GOOGLE_REDIRECT_URI || 
    `${req.protocol}://${req.get('host')}/auth/google/callback`;

  try {
    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
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

    const tokens = await tokenResponse.json();
    if (!tokens.access_token) {
      throw new Error('No access token received');
    }

    // Get user info
    const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` }
    });

    const userInfo = await userResponse.json();
    
    // Store/update user in database
    const userId = `google_${userInfo.id}`;
    let user = await stores.students.get(userId);
    
    if (!user) {
      user = await stores.students.create({
        id: userId,
        googleId: userInfo.id,
        googleEmail: userInfo.email,
        name: userInfo.name,
        picture: userInfo.picture,
        lastLogin: new Date().toISOString()
      });
    } else {
      user = await stores.students.update(userId, {
        ...user,
        lastLogin: new Date().toISOString(),
        picture: userInfo.picture
      });
    }

    // Save login session in HttpOnly cookies, then redirect without user data params
    res.cookie('auth_user_id', user.id, {
      httpOnly: true,
      secure: req.secure,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });
    res.cookie('google_authenticated', 'true', {
      httpOnly: true,
      secure: req.secure,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });
    res.clearCookie('oauth_state');

    const redirectUrl = new URL(appOrigin);
    redirectUrl.searchParams.set('oauth_login', 'success');

    res.redirect(redirectUrl.toString());
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.redirect(`${appOrigin}/?oauth_login=error&error=${encodeURIComponent(error.message)}`);
  }
});

app.get('/auth/me', async (req, res) => {
  try {
    const userId = req.cookies?.auth_user_id;
    const isAuthed = req.cookies?.google_authenticated === 'true';

    if (!userId || !isAuthed) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const user = await stores.students.get(String(userId));
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    return res.json({
      id: user.id,
      name: user.name || '',
      email: user.googleEmail || '',
      googleId: user.googleId || '',
      picture: user.picture || null,
      provider: 'google',
      authenticated: true
    });
  } catch (error) {
    console.error('Auth me error:', error);
    return res.status(500).json({ error: 'Server error', details: error.message });
  }
});

// Link Google account to local account
app.post('/auth/link-google', async (req, res) => {
  try {
    const { localUserId, googleUserId } = req.body;
    
    if (!localUserId || !googleUserId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const localUser = await stores.students.get(localUserId);
    const googleUser = await stores.students.get(googleUserId);

    if (!googleUser) {
      return res.status(404).json({ error: 'Google user not found' });
    }

    // Link accounts
    await stores.students.update(googleUserId, {
      ...googleUser,
      linkedUserId: localUserId
    });

    if (localUser) {
      await stores.students.update(localUserId, {
        ...localUser,
        googleId: googleUser.googleId,
        googleEmail: googleUser.googleEmail
      });
    }

    res.json({ success: true, user: googleUser, linkedUser: localUser });
  } catch (error) {
    console.error('Link account error:', error);
    res.status(500).json({ error: 'Server error', details: error.message });
  }
});

// AI Generation endpoint (using OpenAI/Gemini)
app.post('/api/generate-cards', async (req, res) => {
  const { topic, count = 10 } = req.body;
  const requestedCount = Number.isFinite(Number(count)) ? Number(count) : 10;
  const cappedCount = Math.max(1, Math.min(20, Math.floor(requestedCount)));

  if (!topic) {
    return res.status(400).json({ error: 'Topic is required' });
  }

  const groqKey = process.env.GROQ_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  try {
    let cards = [];
    let fallbackSource = '';

    // Prefer Groq (Llama 3.3 70B)
    if (groqKey) {
      try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${groqKey}`
          },
          body: JSON.stringify({
            model: 'meta-llama/llama-4-scout-17b-16e-instruct',
            messages: [
              {
                role: 'system',
                content: `Generate exactly ${cappedCount} educational flashcards. Return ONLY JSON: {"cards":[{"question":"...","answer":"..."}]}`
              },
              {
                role: 'user',
                content: `Topic: ${topic}`
              }
            ],
            temperature: 0.7,
            max_tokens: 1500
          })
        });

        const data = await response.json();
        const raw = data?.choices?.[0]?.message?.content || '';
        fallbackSource = raw;
        const match = raw.match(/```json\s*([\s\S]*?)```/) || raw.match(/```\s*([\s\S]*?)```/) || [null, raw];
        const parsed = JSON.parse(match[1] || raw);
        if (parsed.cards && Array.isArray(parsed.cards)) {
          cards = parsed.cards.slice(0, 20).map((card, index) => {
            const questionRaw = typeof card.question === 'string' ? card.question.trim() : typeof card.front === 'string' ? card.front.trim() : '';
            const answerRaw = typeof card.answer === 'string' ? card.answer.trim() : typeof card.back === 'string' ? card.back.trim() : '';
            const questionClean = questionRaw && questionRaw.toLowerCase() !== 'undefined' ? questionRaw : '';
            const answerClean = answerRaw && answerRaw.toLowerCase() !== 'undefined' ? answerRaw : '';
            return {
              question: questionClean || `Question ${index + 1} about ${topic}`,
              answer: answerClean || `Key facts about ${topic}.`
            };
          });
        }
      } catch (groqError) {
        console.error('Groq error:', groqError.message);
      }
    }

    // Try Gemini next (if configured)
    if (cards.length === 0 && geminiKey) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{
                parts: [{
                  text: `Generate exactly ${cappedCount} educational flashcards about "${topic}". Return ONLY a JSON array with this exact format: {"cards":[{"question":"...","answer":"..."}]}. Each flashcard should be concise and educational.`
                }]
              }],
              generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 2048
              }
            })
          }
        );

        const data = await response.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        fallbackSource = text;
        
        // Extract JSON from markdown code blocks if present
        const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || 
                         text.match(/```\s*([\s\S]*?)\s*```/) ||
                         [null, text];
        
        const parsed = JSON.parse(jsonMatch[1] || text);
        if (parsed.cards && Array.isArray(parsed.cards)) {
          cards = parsed.cards.slice(0, 20).map((card, index) => {
            const questionRaw = typeof card.question === 'string' ? card.question.trim() : typeof card.front === 'string' ? card.front.trim() : '';
            const answerRaw = typeof card.answer === 'string' ? card.answer.trim() : typeof card.back === 'string' ? card.back.trim() : '';
            const questionClean = questionRaw && questionRaw.toLowerCase() !== 'undefined' ? questionRaw : '';
            const answerClean = answerRaw && answerRaw.toLowerCase() !== 'undefined' ? answerRaw : '';
            return {
              question: questionClean || `Question ${index + 1} about ${topic}`,
              answer: answerClean || `Key facts about ${topic}.`
            };
          });
        }
      } catch (geminiError) {
        console.error('Gemini error:', geminiError.message);
      }
    }

    // Fallback to OpenAI if Gemini fails
    if (cards.length === 0 && openaiKey) {
      try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openaiKey}`
          },
          body: JSON.stringify({
            model: 'gpt-3.5-turbo',
            messages: [{
              role: 'system',
              content: `Generate exactly ${cappedCount} educational flashcards. Return ONLY JSON: {"cards":[{"question":"...","answer":"..."}]}`
            }, {
              role: 'user',
              content: `Topic: ${topic}`
            }],
            max_tokens: 1500,
            temperature: 0.7
          })
        });

        const data = await response.json();
        const text = data?.choices?.[0]?.message?.content || '';
        fallbackSource = text;
        const parsed = JSON.parse(text);
        if (parsed.cards && Array.isArray(parsed.cards)) {
          cards = parsed.cards.slice(0, 20).map((card, index) => {
            const questionRaw = typeof card.question === 'string' ? card.question.trim() : typeof card.front === 'string' ? card.front.trim() : '';
            const answerRaw = typeof card.answer === 'string' ? card.answer.trim() : typeof card.back === 'string' ? card.back.trim() : '';
            const questionClean = questionRaw && questionRaw.toLowerCase() !== 'undefined' ? questionRaw : '';
            const answerClean = answerRaw && answerRaw.toLowerCase() !== 'undefined' ? answerRaw : '';
            return {
              question: questionClean || `Question ${index + 1} about ${topic}`,
              answer: answerClean || `Key facts about ${topic}.`
            };
          });
        }
      } catch (openaiError) {
        console.error('OpenAI error:', openaiError.message);
      }
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

    // Fallback: generate simple cards if AI fails
    if (cards.length === 0) {
      const fallbackLines = (fallbackSource || '')
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean);

      const fallbackCount = Math.min(
        Math.max(cappedCount, fallbackLines.length || 1),
        20
      );
      const fallbackCards = [];

      for (let i = 0; i < fallbackCount; i++) {
        const rawLine = fallbackLines[i] || '';
        const extracted = coerceFromLine(rawLine);

        const questionText = (extracted.question || extracted.front || extracted.prompt || rawLine || `Question ${i + 1} about ${topic}`).trim();
        const answerText = (extracted.answer || extracted.back || extracted.response || extracted.explanation || (rawLine ? rawLine.replace(/^Answer:\s*/i, '') : '') || `Key facts about ${topic}.`).trim();

        fallbackCards.push({
          question: questionText || `Question ${i + 1} about ${topic}`,
          answer: answerText || `Key facts about ${topic}.`
        });
      }

      cards = fallbackCards;
    }

    res.json({ cards: cards.slice(0, 20) });
  } catch (error) {
    console.error('Generate cards error:', error);
    res.status(500).json({ error: 'Failed to generate cards', details: error.message });
  }
});

// AI-powered card generation (standardized endpoint)
app.post('/api/ai/generate', async (req, res) => {
  const { topic, count = 5, prompt, text, rawText } = req.body;
  const parsedCount = Number.isFinite(Number(count)) ? Number(count) : 5;
  const cappedCount = Math.max(1, Math.min(20, Math.floor(parsedCount)));

  const groqKey = process.env.GROQ_API_KEY;

  if (!groqKey) {
    return res.status(400).json({ error: 'AI key not configured. Set GROQ_API_KEY environment variable.' });
  }

  const safeTopic = topic && String(topic).trim() ? String(topic).trim() : 'the subject';
  const systemPrompt = `You are a helpful assistant that converts study material into flashcards. Reply with valid JSON only: {"cards": [{"question":"Question text","answer":"Answer text"}]}. Create ${cappedCount} concise cards covering distinct points.`;
  const userPrompt = prompt || text || `Create flashcard Q&A pairs about ${safeTopic}.`;

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${groqKey}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 800
      })
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      console.error(`Groq API error ${response.status}:`, errorBody);
      throw new Error(`Groq API error: ${response.status}`);
    }

    const data = await response.json();
    let content = data?.choices?.[0]?.message?.content || '';

    // Extract JSON from markdown code blocks if present
    if (content.includes('```')) {
      const match = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (match && match[1]) {
        content = match[1];
      }
    }

    const parsed = JSON.parse(content);
    
    if (Array.isArray(parsed.cards)) {
      const cards = parsed.cards.slice(0, 20).map((c, i) => {
        const questionRaw = typeof c.question === 'string' ? c.question.trim() : typeof c.front === 'string' ? c.front.trim() : '';
        const answerRaw = typeof c.answer === 'string' ? c.answer.trim() : typeof c.back === 'string' ? c.back.trim() : '';
        const questionClean = questionRaw && questionRaw.toLowerCase() !== 'undefined' ? questionRaw : '';
        const answerClean = answerRaw && answerRaw.toLowerCase() !== 'undefined' ? answerRaw : '';
        return {
          id: c.id || `card_${Date.now()}_${i}`,
          question: questionClean || `Question ${i + 1} about ${safeTopic}`,
          answer: answerClean || `Key facts about ${safeTopic}.`
        };
      });
      return res.json({ cards });
    }

    throw new Error('Invalid AI response format');
  } catch (error) {
    console.error('AI generation error:', error);
    
    // Return fallback cards instead of error
    const fallbackCards = [];
    for (let i = 0; i < cappedCount; i++) {
      fallbackCards.push({
        id: `card_${Date.now()}_${i}`,
        question: `Question ${i + 1} about ${safeTopic}`,
        answer: `Key facts about ${safeTopic}.`
      });
    }
    
    return res.json({ cards: fallbackCards });
  }
});

// AI-powered quiz generation
app.post('/api/ai/quiz', async (req, res) => {
  const { topic = 'General knowledge', count = 5 } = req.body;
  const cappedCount = Math.max(1, Math.min(20, count || 5));

  const groqKey = process.env.GROQ_API_KEY;

  if (!groqKey) {
    return res.status(400).json({ error: 'AI key not configured. Set GROQ_API_KEY environment variable.' });
  }

  const systemPrompt = `You are a quiz generator. Generate multiple-choice quiz questions in strict JSON format.

CRITICAL: Do NOT include letter prefixes (A), B), C), D)) or numbers (1., 2.) in the option text.

Format: {"questions":[{"question":"What is X?","options":["First answer","Second answer","Third answer","Fourth answer"],"correct":"First answer"}]}

Rules:
- Provide exactly ${cappedCount} questions about ${topic}
- Each option should be JUST the answer text, no prefixes
- The "correct" field should be the EXACT TEXT of the correct option (not a letter)
- Options must be concise, distinct, and accurate
- Return ONLY valid JSON, no other text`;

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${groqKey}`
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
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      console.error(`Groq API error ${response.status}:`, errorBody);
      throw new Error(`Groq API error: ${response.status}`);
    }

    const data = await response.json();
    let content = data?.choices?.[0]?.message?.content || '';

    // Extract JSON from markdown code blocks if present
    if (content.includes('```')) {
      const match = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (match && match[1]) {
        content = match[1];
      }
    }

    const parsed = JSON.parse(content);
    
    if (Array.isArray(parsed.questions) && parsed.questions.length) {
      return res.json({ questions: parsed.questions.slice(0, cappedCount) });
    }

    throw new Error('Invalid AI response format');
  } catch (error) {
    console.error('AI quiz generation error:', error);
    
    // Return fallback questions
    const fallbackQuestions = Array.from({ length: cappedCount }).map((_, i) => {
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
    
    return res.json({ questions: fallbackQuestions });
  }
});

// Setup CRUD routes
createCRUDRoutes(app, '/api/classes', stores.classes, { ownerField: 'teacherId' });
createCRUDRoutes(app, '/api/quizzes', stores.quizzes, { ownerField: 'teacherId' });
createCRUDRoutes(app, '/api/students', stores.students, { ownerField: 'id' });
createCRUDRoutes(app, '/api/teachers', stores.teachers, { ownerField: 'id' });
createCRUDRoutes(app, '/api/enrollments', stores.enrollments, { ownerField: 'studentId' });
createCRUDRoutes(app, '/api/flashcards', stores.flashcards, { ownerField: 'userId' });
createCRUDRoutes(app, '/api/attempts', stores.quizzes, { ownerField: 'studentId' }); // Share with quizzes

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error', details: err.message });
});

// Start server
ensureDataDir().then(() => {
  app.listen(PORT, () => {
    console.log(`✅ EClassroom Backend running on port ${PORT}`);
    console.log(`📁 Data directory: ${DATA_DIR}`);
    console.log(`🌍 API: http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
