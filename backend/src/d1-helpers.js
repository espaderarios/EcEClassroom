// D1 Database helpers for flashcard data

export async function initDB(db) {
  // D1 DB is already initialized via binding in wrangler.toml
  return db;
}

// Flashcards CRUD
export async function createFlashcard(db, card) {
  const { id, user_id, set_id, question, answer } = card;
  
  const result = await db
    .prepare(
      `INSERT INTO flashcards (id, user_id, set_id, question, answer)
       VALUES (?, ?, ?, ?, ?)`
    )
    .bind(id, user_id, set_id, question, answer)
    .run();

  return result.success ? { id, ...card } : null;
}

export async function getFlashcards(db, userId, setId = null) {
  let query = `SELECT * FROM flashcards WHERE user_id = ?`;
  const params = [userId];

  if (setId) {
    query += ` AND set_id = ?`;
    params.push(setId);
  }

  query += ` ORDER BY created_at DESC`;

  const result = await db.prepare(query).bind(...params).all();
  return result.results || [];
}

export async function getFlashcard(db, cardId) {
  const result = await db
    .prepare(`SELECT * FROM flashcards WHERE id = ?`)
    .bind(cardId)
    .first();

  return result || null;
}

export async function updateFlashcard(db, cardId, updates) {
  const { question, answer } = updates;
  
  const result = await db
    .prepare(
      `UPDATE flashcards 
       SET question = ?, answer = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    )
    .bind(question, answer, cardId)
    .run();

  return result.success;
}

export async function deleteFlashcard(db, cardId) {
  const result = await db
    .prepare(`DELETE FROM flashcards WHERE id = ?`)
    .bind(cardId)
    .run();

  return result.success;
}

// Flashcard Sets CRUD
export async function createFlashcardSet(db, set) {
  const { id, user_id, name, subject, icon, visibility } = set;
  
  const result = await db
    .prepare(
      `INSERT INTO flashcard_sets (id, user_id, name, subject, icon, visibility)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .bind(id, user_id, name, subject, icon, visibility || 'private')
    .run();

  return result.success ? { id, ...set } : null;
}

export async function getFlashcardSets(db, userId) {
  const result = await db
    .prepare(
      `SELECT * FROM flashcard_sets 
       WHERE user_id = ? 
       ORDER BY created_at DESC`
    )
    .bind(userId)
    .all();

  return result.results || [];
}

export async function updateFlashcardSet(db, setId, updates) {
  const { name, subject, icon } = updates;
  
  const result = await db
    .prepare(
      `UPDATE flashcard_sets 
       SET name = ?, subject = ?, icon = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    )
    .bind(name, subject, icon, setId)
    .run();

  return result.success;
}

export async function deleteFlashcardSet(db, setId) {
  const result = await db
    .prepare(`DELETE FROM flashcard_sets WHERE id = ?`)
    .bind(setId)
    .run();

  return result.success;
}

// Users CRUD
export async function createUser(db, user) {
  const { id, email, name, google_id, google_email, picture_url, provider, authenticated } = user;
  
  const result = await db
    .prepare(
      `INSERT INTO users (id, email, name, google_id, google_email, picture_url, provider, authenticated)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(id, email || null, name || null, google_id || null, google_email || null, picture_url || null, provider || 'local', authenticated ? 1 : 0)
    .run();

  return result.success ? { id, ...user } : null;
}

export async function getUser(db, userId) {
  const result = await db
    .prepare(`SELECT * FROM users WHERE id = ?`)
    .bind(userId)
    .first();

  return result || null;
}

export async function getUserByEmail(db, email) {
  const result = await db
    .prepare(`SELECT * FROM users WHERE email = ?`)
    .bind(email)
    .first();

  return result || null;
}

export async function getUserByGoogleId(db, googleId) {
  const result = await db
    .prepare(`SELECT * FROM users WHERE google_id = ?`)
    .bind(googleId)
    .first();

  return result || null;
}

export async function updateUser(db, userId, updates) {
  const { email, name, google_id, picture_url, authenticated } = updates;
  
  const result = await db
    .prepare(
      `UPDATE users 
       SET email = COALESCE(?, email),
           name = COALESCE(?, name),
           google_id = COALESCE(?, google_id),
           picture_url = COALESCE(?, picture_url),
           authenticated = COALESCE(?, authenticated),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    )
    .bind(email, name, google_id, picture_url, authenticated !== undefined ? (authenticated ? 1 : 0) : null, userId)
    .run();

  return result.success;
}

// Quiz Results
export async function createQuizResult(db, result) {
  const { id, user_id, set_id, score, total_questions } = result;
  
  const dbResult = await db
    .prepare(
      `INSERT INTO quiz_results (id, user_id, set_id, score, total_questions)
       VALUES (?, ?, ?, ?, ?)`
    )
    .bind(id, user_id, set_id || null, score, total_questions)
    .run();

  return dbResult.success ? { id, ...result } : null;
}

export async function getQuizResults(db, userId, setId = null) {
  let query = `SELECT * FROM quiz_results WHERE user_id = ?`;
  const params = [userId];

  if (setId) {
    query += ` AND set_id = ?`;
    params.push(setId);
  }

  query += ` ORDER BY created_at DESC LIMIT 50`;

  const result = await db.prepare(query).bind(...params).all();
  return result.results || [];
}
