const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const db  = require('../config/db');

/**
 * Socket.io event contract
 * ─────────────────────────────────────────────────────────────
 *
 * CLIENT → SERVER
 *   host:join          { sessionId, token }
 *   participant:join   { joinCode, displayName, token? }   ← token now optional
 *   host:next          { sessionId }
 *   host:end           { sessionId }
 *   participant:answer { sessionId, questionId, optionIds: uuid[] }
 *
 * SERVER → CLIENT (room = sessionId)
 *   session:participantJoined  { participant }
 *   session:rejoined           { participant }             ← new, for logged-in reconnect
 *   session:question           { question, index, totalQuestions, timeLimitSec }
 *   session:questionEnded      { questionId, correctOptionIds, stats }
 *   session:ended              { leaderboard }
 *   error                      { message }
 */

function initSocketServer(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN || '*',
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // HOST: join lobby
    socket.on('host:join', async ({ sessionId, token }) => {
      try {
        const userId  = verifyToken(token);
        const session = await getSessionOrFail(sessionId, socket);
        if (!session) return;

        if (session.host_id !== userId) {
          return socket.emit('error', { message: 'Not authorized as host' });
        }

        socket.join(sessionId);
        socket.data = { role: 'host', sessionId, userId };
        console.log(`Host ${userId} joined session ${sessionId}`);
      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    });

    // PARTICIPANT: join lobby
    socket.on('participant:join', async ({ joinCode, displayName, token }) => {
      try {
        if (!joinCode || !displayName?.trim()) {
          return socket.emit('error', { message: 'joinCode and displayName are required' });
        }

        // Resolve optional auth token → userId (null = anonymous)
        let userId = null;
        if (token) {
          try {
            userId = verifyToken(token);
          } catch {
            // Bad token → fall back to anonymous, don't hard-fail
            console.warn('participant:join received invalid token, joining anonymously');
          }
        }

        // Look up active session by join code
        const { rows: sessionRows } = await db.query(
          `SELECT s.id AS session_id, s.status, q.id AS quiz_id
           FROM sessions s
           JOIN quizzes q ON q.id = s.quiz_id
           WHERE q.join_code = $1 AND s.status IN ('waiting', 'question', 'results')`,
          [joinCode.toUpperCase()]
        );

        if (!sessionRows.length) {
          return socket.emit('error', { message: 'No active lobby found for this code' });
        }

        const { session_id: sessionId } = sessionRows[0];

        // Logged-in users: check if already seated (reconnect scenario)
        if (userId) {
          const { rows: existing } = await db.query(
            `SELECT * FROM participants
             WHERE session_id = $1 AND user_id = $2`,
            [sessionId, userId]
          );

          if (existing.length) {
            const participant = existing[0];
            await db.query(
              'UPDATE participants SET socket_id = $1 WHERE id = $2',
              [socket.id, participant.id]
            );

            socket.join(sessionId);
            socket.data = { role: 'participant', sessionId, participantId: participant.id, userId };

            return socket.emit('session:rejoined', { participant, sessionId });
          }
        }

        // Insert new participant
        // ON CONFLICT on display name: update socket_id, preserve existing user_id
        let participant;
        try {
          const { rows: pRows } = await db.query(
            `INSERT INTO participants (session_id, display_name, socket_id, user_id)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (session_id, display_name)
             DO UPDATE
               SET socket_id = EXCLUDED.socket_id,
                   user_id   = COALESCE(participants.user_id, EXCLUDED.user_id)
             RETURNING *`,
            [sessionId, displayName.trim(), socket.id, userId]
          );
          participant = pRows[0];
        } catch {
          return socket.emit('error', { message: 'Display name already taken in this session' });
        }
        
        socket.join(sessionId);
        socket.data = { role: 'participant', sessionId, participantId: participant.id, userId };

        io.to(sessionId).emit('session:participantJoined', { participant, sessionId });

        console.log(
          `👤 ${displayName.trim()} joined session ${sessionId}` +
          (userId ? ` (user: ${userId})` : ' (anonymous)')
        );

        const { rows: sessionState } = await db.query(
          'SELECT * FROM sessions WHERE id = $1', [sessionId]
        );
        const currentSession = sessionState[0];

        if (currentSession.status !== 'waiting') {
          const { rows: questions } = await db.query(
            `SELECT q.*, json_agg(
              json_build_object('id', o.id, 'body', o.body, 'position', o.position)
              ORDER BY o.position
            ) AS options
            FROM questions q
            LEFT JOIN question_options o ON o.question_id = q.id
            WHERE q.quiz_id = $1
            GROUP BY q.id ORDER BY q.position`,
          [currentSession.quiz_id]
          );
          const idx = currentSession.current_question_index;
          if (idx !== null && questions[idx]) {
            socket.emit('session:question', {
              index:          idx,
              totalQuestions: questions.length,
              timeLimitSec:   null, // don't start timer for late joiners
              question:       sanitizeQuestion(questions[idx]),
            });
          }
        }
      }   catch (err) {
        socket.emit('error', { message: err.message });
      }
      
    });

    // HOST: advance to next question
    socket.on('host:next', async ({ sessionId }) => {
      try {
        if (socket.data?.role !== 'host' || socket.data?.sessionId !== sessionId) {
          return socket.emit('error', { message: 'Not authorized' });
        }

        const session = await getSessionOrFail(sessionId, socket);
        if (!session) return;

        const { rows: questions } = await db.query(
          `SELECT q.*, json_agg(
             json_build_object(
               'id',       o.id,
               'body',     o.body,
               'position', o.position
             ) ORDER BY o.position
           ) AS options
           FROM questions q
           LEFT JOIN question_options o ON o.question_id = q.id
           WHERE q.quiz_id = $1
           GROUP BY q.id
           ORDER BY q.position`,
          [session.quiz_id]
        );

        const currentIndex = session.current_question_index ?? -1;
        const nextIndex    = currentIndex + 1;

        // Emit results for the question we just finished
        if (currentIndex >= 0 && currentIndex < questions.length) {
          await emitQuestionResults(io, sessionId, questions[currentIndex]);
        }

        if (nextIndex >= questions.length) {
          return endSession(io, sessionId, session.quiz_id);
        }

        const nextQuestion = questions[nextIndex];
        const now          = new Date();

        await db.query(
        `UPDATE sessions
          SET status = 'question',
          current_question_index = $1,
          question_started_at = $2,
          started_at = COALESCE(started_at, $2)
          WHERE id = $3`,
        [nextIndex, now, sessionId]
        );

        io.to(sessionId).emit('session:question', {
          index:          nextIndex,
          totalQuestions: questions.length,
          timeLimitSec:   nextQuestion.time_limit_sec || null,
          question:       sanitizeQuestion(nextQuestion),
        });

        if (nextQuestion.time_limit_sec) {
          setTimeout(async () => {
            const { rows: fresh } = await db.query(
              'SELECT current_question_index FROM sessions WHERE id = $1',
              [sessionId]
            );
            if (fresh[0]?.current_question_index === nextIndex) {
              await emitQuestionResults(io, sessionId, nextQuestion);
            }
          }, nextQuestion.time_limit_sec * 1000);
        }
      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    });

    // PARTICIPANT: submit answer
    socket.on('participant:answer', async ({ sessionId, questionId, optionIds }) => {
      try {
        const { participantId } = socket.data || {};
        if (!participantId) {
          return socket.emit('error', { message: 'Not joined as participant' });
        }

        const session = await getSessionOrFail(sessionId, socket);
        if (!session || session.status !== 'question') {
          return socket.emit('error', { message: 'No active question' });
        }

        const { rows: correctRows } = await db.query(
          'SELECT id FROM question_options WHERE question_id = $1 AND is_correct = TRUE',
          [questionId]
        );
        const correctIds = correctRows.map((r) => r.id);

        const isCorrect =
          Array.isArray(optionIds) &&
          optionIds.length === correctIds.length &&
          optionIds.every((id) => correctIds.includes(id));

        const { rows: qRows } = await db.query(
          'SELECT points FROM questions WHERE id = $1',
          [questionId]
        );
        const basePoints    = qRows[0]?.points ?? 100;
        const pointsAwarded = isCorrect ? basePoints : 0;

        const responseMs = session.question_started_at
          ? Date.now() - new Date(session.question_started_at).getTime()
          : null;

        await db.query(
          `INSERT INTO answers
             (session_id, participant_id, question_id, chosen_option_ids,
              is_correct, points_awarded, response_time_ms)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (session_id, participant_id, question_id) DO NOTHING`,
          [sessionId, participantId, questionId, optionIds, isCorrect, pointsAwarded, responseMs]
        );

        if (isCorrect) {
          await db.query(
            'UPDATE participants SET score = score + $1 WHERE id = $2',
            [pointsAwarded, participantId]
          );
        }

        socket.emit('answer:received', { isCorrect, pointsAwarded });

        socket.to(sessionId).emit('answer:submitted', { participantId });
      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    });

    // HOST: end session early
    socket.on('host:end', async ({ sessionId }) => {
      try {
        if (socket.data?.role !== 'host' || socket.data?.sessionId !== sessionId) {
          return socket.emit('error', { message: 'Not authorized' });
        }
        const session = await getSessionOrFail(sessionId, socket);
        if (session) await endSession(io, sessionId, session.quiz_id);
      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    });

    // Disconnect
    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });

  return io;
}

// Helpers

function verifyToken(token) {
  const payload = jwt.verify(
    token,
    process.env.JWT_SECRET || 'change_this_in_production'
  );
  return payload.sub;
}

async function getSessionOrFail(sessionId, socket) {
  const { rows } = await db.query('SELECT * FROM sessions WHERE id = $1', [sessionId]);
  if (!rows.length) {
    socket.emit('error', { message: 'Session not found' });
    return null;
  }
  return rows[0];
}

function sanitizeQuestion(question) {
  return {
    ...question,
    options: (question.options || []).map(({ is_correct, isCorrect, ...o }) => o),
  };
}

async function emitQuestionResults(io, sessionId, question) {
  const { rows: correctRows } = await db.query(
    'SELECT id FROM question_options WHERE question_id = $1 AND is_correct = TRUE',
    [question.id]
  );

  const { rows: stats } = await db.query(
    'SELECT * FROM v_question_results WHERE session_id = $1 AND question_id = $2',
    [sessionId, question.id]
  );

  await db.query(`UPDATE sessions SET status = 'results' WHERE id = $1`, [sessionId]);

  io.to(sessionId).emit('session:questionEnded', {
    questionId:       question.id,
    correctOptionIds: correctRows.map((r) => r.id),
    stats:            stats[0] || null,
  });
}

async function endSession(io, sessionId, quizId) {
  await db.query(
    `UPDATE sessions SET status = 'finished', ended_at = NOW() WHERE id = $1`,
    [sessionId]
  );
  await db.query(`UPDATE quizzes SET status = 'ended' WHERE id = $1`, [quizId]);

  const { rows: leaderboard } = await db.query(
    'SELECT * FROM v_leaderboard WHERE session_id = $1 ORDER BY rank',
    [sessionId]
  );

  io.to(sessionId).emit('session:ended', { leaderboard });
}

module.exports = { initSocketServer };