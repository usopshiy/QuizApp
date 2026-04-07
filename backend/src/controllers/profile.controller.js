const db = require('../config/db');

// Organizer: all finished sessions across their quizzes
async function getOrganizerSessions(req, res, next) {
  try {
    const { rows } = await db.query(
      `SELECT
         s.id                  AS session_id,
         s.started_at,
         s.ended_at,
         q.id                  AS quiz_id,
         q.title               AS quiz_title,
         q.join_code,
         COUNT(p.id)::int      AS participant_count,
         MAX(p.score)          AS top_score
       FROM sessions s
       JOIN quizzes q   ON q.id = s.quiz_id
       LEFT JOIN participants p ON p.session_id = s.id
       WHERE q.owner_id = $1
         AND s.status   = 'finished'
       GROUP BY s.id, q.id
       ORDER BY s.ended_at DESC`,
      [req.user.sub]
    );

    res.json({ sessions: rows });
  } catch (err) {
    next(err);
  }
}

// Participant (logged-in): all sessions they joined
async function getParticipantSessions(req, res, next) {
  try {
    const { rows } = await db.query(
      `SELECT
         s.id                AS session_id,
         s.started_at,
         s.ended_at,
         q.title             AS quiz_title,
         q.join_code,
         p.id                AS participant_id,
         p.display_name,
         p.score,
         lb.rank,
         COUNT(a.id)::int    AS questions_answered,
         SUM(CASE WHEN a.is_correct THEN 1 ELSE 0 END)::int AS correct_answers
       FROM participants p
       JOIN sessions s      ON s.id = p.session_id
       JOIN quizzes q       ON q.id = s.quiz_id
       LEFT JOIN v_leaderboard lb
              ON lb.session_id = s.id AND lb.participant_id = p.id
       LEFT JOIN answers a  ON a.participant_id = p.id AND a.session_id = s.id
       WHERE p.user_id  = $1
         AND s.status   = 'finished'
       GROUP BY s.id, q.id, p.id, lb.rank
       ORDER BY s.ended_at DESC`,
      [req.user.sub]
    );

    res.json({ sessions: rows });
  } catch (err) {
    next(err);
  }
}

// Full session results (used by both cabinets + export)
// Returns every question with every participant's answer.
// Accessible by the session host or any participant who took part.
async function getSessionResults(req, res, next) {
  try {
    const { sessionId } = req.params;
    const userId        = req.user.sub;

    // Authorisation: must be host OR a registered participant in this session
    const { rows: authRows } = await db.query(
      `SELECT s.id FROM sessions s
       LEFT JOIN participants p ON p.session_id = s.id AND p.user_id = $2
       WHERE s.id = $1
         AND (s.host_id = $2 OR p.id IS NOT NULL)
       LIMIT 1`,
      [sessionId, userId]
    );

    if (!authRows.length) {
      return res.status(403).json({ error: 'Access denied to this session' });
    }

    // Session summary
    const { rows: sessionRows } = await db.query(
      `SELECT s.*, q.title AS quiz_title, q.join_code
       FROM sessions s
       JOIN quizzes q ON q.id = s.quiz_id
       WHERE s.id = $1`,
      [sessionId]
    );

    // Leaderboard
    const { rows: leaderboard } = await db.query(
      'SELECT * FROM v_leaderboard WHERE session_id = $1 ORDER BY rank',
      [sessionId]
    );

    // Per-question breakdown: correct options + per-participant answers
    const { rows: questions } = await db.query(
      `SELECT
         q.id,
         q.body,
         q.image_url,
         q.position,
         q.type,
         q.points,
         -- Correct option ids as array
         ARRAY(
           SELECT o.id FROM question_options o
           WHERE  o.question_id = q.id AND o.is_correct = TRUE
         ) AS correct_option_ids,
         -- All options
         json_agg(
           json_build_object(
             'id',        o.id,
             'body',      o.body,
             'isCorrect', o.is_correct,
             'position',  o.position
           ) ORDER BY o.position
         ) AS options,
         -- Stats from view
         qs.correct_count,
         qs.total_answers,
         qs.correct_pct,
         qs.avg_response_ms
       FROM questions q
       LEFT JOIN question_options o ON o.question_id = q.id
       LEFT JOIN v_question_results qs
              ON qs.question_id = q.id AND qs.session_id = $1
       WHERE q.quiz_id = (SELECT quiz_id FROM sessions WHERE id = $1)
       GROUP BY q.id, qs.correct_count, qs.total_answers, qs.correct_pct, qs.avg_response_ms
       ORDER BY q.position`,
      [sessionId]
    );

    // Each participant's answers (flat — frontend groups by question)
    const { rows: answers } = await db.query(
      `SELECT
         a.question_id,
         a.participant_id,
         p.display_name,
         a.chosen_option_ids,
         a.is_correct,
         a.points_awarded,
         a.response_time_ms
       FROM answers a
       JOIN participants p ON p.id = a.participant_id
       WHERE a.session_id = $1
       ORDER BY a.question_id, p.display_name`,
      [sessionId]
    );

    res.json({
      session:     sessionRows[0],
      leaderboard,
      questions,
      answers,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getOrganizerSessions, getParticipantSessions, getSessionResults };