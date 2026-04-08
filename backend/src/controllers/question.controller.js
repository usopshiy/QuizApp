const db                 = require('../config/db');
const { uploadImage, deleteImage } = require('../services/minio.service');

// Add question to a quiz
async function createQuestion(req, res, next) {
  try {
    const { quizId } = req.params;
    const { type = 'single', body, timeLimitSec, points } = req.body;

    // Ownership check
    const { rows: quiz } = await db.query(
      `SELECT id FROM quizzes WHERE id = $1 AND owner_id = $2 AND status <> 'archived'`,
      [quizId, req.user.sub]
    );
    if (!quiz.length) return res.status(404).json({ error: 'Quiz not found' });

    // Must have text body or an uploaded image
    let imageUrl = null;
    if (req.file) {
      imageUrl = await uploadImage(req.file.buffer, req.file.mimetype, req.file.originalname);
    }

    if (!body && !imageUrl) {
      return res.status(400).json({ error: 'Question must have a body text or an image' });
    }

    // Parse options

    let { options } = req.body;
    if (typeof options === 'string') {
      try {
        options = JSON.parse(options);
      } catch (error) {
        return res.status(400).json({ error: 'Invalid format for options' });
      }
    }

    // Validate options
    if (!Array.isArray(options) || options.length < 2) {
      return res.status(400).json({ error: 'Provide at least 2 options' });
    }

    const correctCount = options.filter((o) => o.isCorrect).length;
    if (correctCount === 0) {
      return res.status(400).json({ error: 'At least one option must be correct' });
    }
    if (type === 'single' && correctCount > 1) {
      return res.status(400).json({ error: 'Single-choice questions must have exactly one correct option' });
    }

    // Get next position
    const { rows: posRows } = await db.query(
      'SELECT COALESCE(MAX(position), -1) + 1 AS next_pos FROM questions WHERE quiz_id = $1',
      [quizId]
    );
    const position = posRows[0].next_pos;

    // Insert question
    const { rows: qRows } = await db.query(
      `INSERT INTO questions (quiz_id, type, body, image_url, position, time_limit_sec, points)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [quizId, type, body || null, imageUrl, position, timeLimitSec || null, parseInt(points) || 100]
    );
    const question = qRows[0];

    // Insert options
    const optionValues = options.map((o, i) => [question.id, o.body, !!o.isCorrect, i]);
    const insertedOptions = [];
    for (const [qId, oBody, isCorrect, pos] of optionValues) {
      const { rows } = await db.query(
        `INSERT INTO question_options (question_id, body, is_correct, position)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [qId, oBody, isCorrect, pos]
      );
      insertedOptions.push(rows[0]);
    }

    res.status(201).json({ question: { ...question, options: insertedOptions } });
  } catch (err) {
    next(err);
  }
}

// Update question
async function updateQuestion(req, res, next) {
  try {
    const { quizId, questionId } = req.params;
    const { body, type, timeLimitSec, points, options } = req.body;

    // Ownership check
    const { rows: existing } = await db.query(
      `SELECT q.* FROM questions q
       JOIN quizzes qz ON qz.id = q.quiz_id
       WHERE q.id = $1 AND q.quiz_id = $2 AND qz.owner_id = $3`,
      [questionId, quizId, req.user.sub]
    );
    if (!existing.length) return res.status(404).json({ error: 'Question not found' });

    const current = existing[0];
    let imageUrl = current.image_url;

    // Replace image if a new one was uploaded
    if (req.file) {
      if (current.image_url) await deleteImage(current.image_url);
      imageUrl = await uploadImage(req.file.buffer, req.file.mimetype, req.file.originalname);
    }

    const { rows } = await db.query(
      `UPDATE questions
       SET body           = COALESCE($1, body),
           type           = COALESCE($2, type),
           image_url      = $3,
           time_limit_sec = COALESCE($4, time_limit_sec),
           points         = COALESCE($5, points)
       WHERE id = $6
       RETURNING *`,
      [body || null, type || null, imageUrl, timeLimitSec || null, points || null, questionId]
    );
    const question = rows[0];

    // Replace options if provided
    if (Array.isArray(options) && options.length >= 2) {
      await db.query('DELETE FROM question_options WHERE question_id = $1', [questionId]);
      const insertedOptions = [];
      for (const [i, o] of options.entries()) {
        const { rows: oRows } = await db.query(
          `INSERT INTO question_options (question_id, body, is_correct, position)
           VALUES ($1, $2, $3, $4) RETURNING *`,
          [questionId, o.body, !!o.isCorrect, i]
        );
        insertedOptions.push(oRows[0]);
      }
      return res.json({ question: { ...question, options: insertedOptions } });
    }

    res.json({ question });
  } catch (err) {
    next(err);
  }
}

// Delete question 
async function deleteQuestion(req, res, next) {
  try {
    const { quizId, questionId } = req.params;

    const { rows } = await db.query(
      `SELECT q.* FROM questions q
       JOIN quizzes qz ON qz.id = q.quiz_id
       WHERE q.id = $1 AND q.quiz_id = $2 AND qz.owner_id = $3`,
      [questionId, quizId, req.user.sub]
    );
    if (!rows.length) return res.status(404).json({ error: 'Question not found' });

    // Remove image from MinIO if present
    if (rows[0].image_url) await deleteImage(rows[0].image_url);

    await db.query('DELETE FROM questions WHERE id = $1', [questionId]);

    // Reorder remaining questions to close gap
    await db.query(
      `UPDATE questions
       SET position = sub.new_pos
       FROM (
         SELECT id, ROW_NUMBER() OVER (ORDER BY position) - 1 AS new_pos
         FROM questions WHERE quiz_id = $1
       ) sub
       WHERE questions.id = sub.id`,
      [quizId]
    );

    res.json({ message: 'Question deleted' });
  } catch (err) {
    next(err);
  }
}

// Reorder questions
// Body: { orderedIds: ['uuid1', 'uuid2', ...] }
async function reorderQuestions(req, res, next) {
  try {
    const { quizId } = req.params;
    const { orderedIds } = req.body;

    if (!Array.isArray(orderedIds)) {
      return res.status(400).json({ error: 'orderedIds must be an array of question UUIDs' });
    }

    // Update positions in a single query using unnest
    await db.query(
      `UPDATE questions
       SET position = data.pos
       FROM (
         SELECT UNNEST($1::uuid[]) AS id, GENERATE_SERIES(0, $2) AS pos
       ) data
       WHERE questions.id = data.id AND questions.quiz_id = $3`,
      [orderedIds, orderedIds.length - 1, quizId]
    );

    res.json({ message: 'Questions reordered' });
  } catch (err) {
    next(err);
  }
}

module.exports = { createQuestion, updateQuestion, deleteQuestion, reorderQuestions };