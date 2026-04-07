const db = require('../config/db');
const { nanoid } = require('nanoid');

// List organizer's quizzes
async function listQuizzes(req, res, next) {
  try {
    const { rows } = await db.query(
      `SELECT q.*, COUNT(qs.id)::int AS question_count
       FROM quizzes q
       LEFT JOIN questions qs ON qs.quiz_id = q.id
       WHERE q.owner_id = $1 AND q.status <> 'archived'
       GROUP BY q.id
       ORDER BY q.created_at DESC`,
      [req.user.sub]
    );
    res.json({ quizzes: rows });
  } catch (err) {
    next(err);
  }
}

// Get single quiz with questions + options
async function getQuiz(req, res, next) {
  try {
    const { id } = req.params;

    const { rows: quizRows } = await db.query(
      'SELECT * FROM quizzes WHERE id = $1 AND owner_id = $2',
      [id, req.user.sub]
    );
    if (!quizRows.length) return res.status(404).json({ error: 'Quiz not found' });

    const quiz = quizRows[0];

    const { rows: questions } = await db.query(
      `SELECT q.*, json_agg(
         json_build_object(
           'id',         o.id,
           'body',       o.body,
           'isCorrect',  o.is_correct,
           'position',   o.position
         ) ORDER BY o.position
       ) AS options
       FROM questions q
       LEFT JOIN question_options o ON o.question_id = q.id
       WHERE q.quiz_id = $1
       GROUP BY q.id
       ORDER BY q.position`,
      [id]
    );

    res.json({ quiz: { ...quiz, questions } });
  } catch (err) {
    next(err);
  }
}

// Create quiz
async function createQuiz(req, res, next) {
  try {
    const { title, description, defaultTimeLimitSec } = req.body;

    if (!title?.trim()) {
      return res.status(400).json({ error: 'title is required' });
    }

    // Generate unique 6-char alphanumeric join code
    const joinCode = nanoid(6).toUpperCase();

    const { rows } = await db.query(
      `INSERT INTO quizzes (owner_id, title, description, join_code, default_time_limit_sec)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [req.user.sub, title.trim(), description || null, joinCode, defaultTimeLimitSec || null]
    );

    res.status(201).json({ quiz: rows[0] });
  } catch (err) {
    next(err);
  }
}

// Update quiz metadata
async function updateQuiz(req, res, next) {
  try {
    const { id } = req.params;
    const { title, description, defaultTimeLimitSec } = req.body;

    const { rows } = await db.query(
      `UPDATE quizzes
       SET title                  = COALESCE($1, title),
           description            = COALESCE($2, description),
           default_time_limit_sec = COALESCE($3, default_time_limit_sec)
       WHERE id = $4 AND owner_id = $5
       RETURNING *`,
      [title?.trim() || null, description || null, defaultTimeLimitSec || null, id, req.user.sub]
    );

    if (!rows.length) return res.status(404).json({ error: 'Quiz not found' });
    res.json({ quiz: rows[0] });
  } catch (err) {
    next(err);
  }
}

// Delete (archive) quiz
async function deleteQuiz(req, res, next) {
  try {
    const { id } = req.params;

    const { rows } = await db.query(
      `UPDATE quizzes SET status = 'archived'
       WHERE id = $1 AND owner_id = $2
       RETURNING id`,
      [id, req.user.sub]
    );

    if (!rows.length) return res.status(404).json({ error: 'Quiz not found' });
    res.json({ message: 'Quiz archived' });
  } catch (err) {
    next(err);
  }
}

// Start a session
async function startSession(req, res, next) {
  try {
    const { id } = req.params;

    // Verify ownership and quiz has at least one question
    const { rows: quizRows } = await db.query(
      `SELECT q.id, COUNT(qs.id)::int AS question_count
       FROM quizzes q
       LEFT JOIN questions qs ON qs.quiz_id = q.id
       WHERE q.id = $1 AND q.owner_id = $2 AND q.status <> 'archived'
       GROUP BY q.id`,
      [id, req.user.sub]
    );

    if (!quizRows.length) return res.status(404).json({ error: 'Quiz not found' });
    if (quizRows[0].question_count === 0) {
      return res.status(400).json({ error: 'Cannot start a quiz with no questions' });
    }

    // DB trigger enforces only one active session per quiz
    const { rows } = await db.query(
      `INSERT INTO sessions (quiz_id, host_id, status)
       VALUES ($1, $2, 'waiting')
       RETURNING *`,
      [id, req.user.sub]
    );

    // Mark quiz as active
    await db.query(`UPDATE quizzes SET status = 'active' WHERE id = $1`, [id]);

    res.status(201).json({ session: rows[0] });
  } catch (err) {
    // Catch the DB trigger violation for duplicate active session
    if (err.message?.includes('already has an active session')) {
      return res.status(409).json({ error: err.message });
    }
    next(err);
  }
}

// Get session details
async function getSession(req, res, next) {
  try {
    const { sessionId } = req.params;

    const { rows } = await db.query(
      `SELECT s.*, q.title AS quiz_title, q.join_code
       FROM sessions s
       JOIN quizzes q ON q.id = s.quiz_id
       WHERE s.id = $1 AND s.host_id = $2`,
      [sessionId, req.user.sub]
    );

    if (!rows.length) return res.status(404).json({ error: 'Session not found' });
    res.json({ session: rows[0] });
  } catch (err) {
    next(err);
  }
}

// Get leaderboard for a session
async function getLeaderboard(req, res, next) {
  try {
    const { sessionId } = req.params;

    const { rows } = await db.query(
      'SELECT * FROM v_leaderboard WHERE session_id = $1 ORDER BY rank',
      [sessionId]
    );

    res.json({ leaderboard: rows });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listQuizzes,
  getQuiz,
  createQuiz,
  updateQuiz,
  deleteQuiz,
  startSession,
  getSession,
  getLeaderboard,
};