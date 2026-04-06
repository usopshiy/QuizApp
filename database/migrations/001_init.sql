-- Exstensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "citext";     -- case-insensitive email

-- Enums

CREATE TYPE user_role AS ENUM ('organizer', 'participant');

-- draft   – being built, not yet startable
-- active  – a session is live right now
-- ended   – session finished, results available
-- archived – soft-deleted / hidden from dashboard
CREATE TYPE quiz_status AS ENUM ('draft', 'active', 'ended', 'archived');

-- single – exactly one correct answer
-- multi  – one or more correct answers
CREATE TYPE question_type AS ENUM ('single', 'multi');

-- waiting   – lobby, waiting for host to start
-- question  – showing a question
-- results   – showing per-question results
-- finished  – leaderboard shown, session closed
CREATE TYPE session_status AS ENUM ('waiting', 'question', 'results', 'finished');

-- Tables

-- Users (organizers who create quizzes)
CREATE TABLE users (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    email           CITEXT          NOT NULL UNIQUE,
    display_name    VARCHAR(100)    NOT NULL,
    password_hash   TEXT            NOT NULL,
    role            user_role       NOT NULL DEFAULT 'organizer',
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- Quizzes created by organizers
CREATE TABLE quizzes (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id        UUID            NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title           VARCHAR(200)    NOT NULL,
    description     TEXT,
    status          quiz_status     NOT NULL DEFAULT 'draft',
    -- Short alphanumeric code participants use to join (e.g. "AB3X9")
    join_code       VARCHAR(10)     NOT NULL UNIQUE,
    -- Time limit per question in seconds, NULL = no limit (host controls pace)
    default_time_limit_sec  INT     CHECK (default_time_limit_sec > 0),
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- Questions belonging to a quiz
CREATE TABLE questions (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    quiz_id         UUID            NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    type            question_type   NOT NULL DEFAULT 'single',
    -- Question body text (may be empty when image_url is set)
    body            TEXT,
    -- Path/URL of the image stored in MinIO (nullable)
    image_url       TEXT,
    -- Allows reordering questions without re-inserting rows
    position        INT             NOT NULL DEFAULT 0,
    -- Override quiz-level time limit for this specific question
    time_limit_sec  INT             CHECK (time_limit_sec > 0),
    -- How many points a correct answer is worth
    points          INT             NOT NULL DEFAULT 100,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    -- Every question must have text, an image, or both
    CONSTRAINT question_has_content CHECK (body IS NOT NULL OR image_url IS NOT NULL)
);

-- Answer options for a question
CREATE TABLE question_options (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id     UUID            NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    body            TEXT            NOT NULL,
    is_correct      BOOLEAN         NOT NULL DEFAULT FALSE,
    position        INT             NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- A live session started from a quiz
-- One quiz can have many historical sessions but only one active at a time
CREATE TABLE sessions (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    quiz_id         UUID            NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    host_id         UUID            NOT NULL REFERENCES users(id),
    status          session_status  NOT NULL DEFAULT 'waiting',
    -- Index (0-based) of the question currently being shown; NULL in waiting/finished
    current_question_index  INT,
    -- Timestamp when the current question was pushed to participants
    question_started_at     TIMESTAMPTZ,
    started_at      TIMESTAMPTZ,
    ended_at        TIMESTAMPTZ,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- Participants who join a session
-- Participants are anonymous (no user account required)
CREATE TABLE participants (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id      UUID            NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    display_name    VARCHAR(80)     NOT NULL,
    -- Socket.io socket id, updated on reconnect
    socket_id       TEXT,
    -- Running total score for this session
    score           INT             NOT NULL DEFAULT 0,
    joined_at       TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    -- A participant may only join with a given name once per session
    UNIQUE (session_id, display_name)
);

-- Answers submitted by participants
CREATE TABLE answers (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id      UUID            NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    participant_id  UUID            NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
    question_id     UUID            NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    -- Array of chosen option IDs (supports multi-choice)
    chosen_option_ids   UUID[]      NOT NULL,
    is_correct      BOOLEAN         NOT NULL DEFAULT FALSE,
    points_awarded  INT             NOT NULL DEFAULT 0,
    -- Milliseconds from question_started_at to submission (for tiebreaking)
    response_time_ms    INT,
    answered_at     TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    -- Each participant can only answer a question once per session
    UNIQUE (session_id, participant_id, question_id)
);

-- ── Indexes ─────────────────────────────────────────────────

-- Quizzes: fast lookup by owner and join code
CREATE INDEX idx_quizzes_owner_id   ON quizzes (owner_id);
CREATE INDEX idx_quizzes_join_code  ON quizzes (join_code);
CREATE INDEX idx_quizzes_status     ON quizzes (status);

-- Questions: ordered fetch for a quiz
CREATE INDEX idx_questions_quiz_id  ON questions (quiz_id, position);

-- Options: all options for a question
CREATE INDEX idx_options_question_id ON question_options (question_id, position);

-- Sessions: active session lookup by quiz
CREATE INDEX idx_sessions_quiz_id   ON sessions (quiz_id);
CREATE INDEX idx_sessions_status    ON sessions (status);

-- Participants: leaderboard query
CREATE INDEX idx_participants_session_score ON participants (session_id, score DESC);

-- Answers: per-session reporting
CREATE INDEX idx_answers_session_id         ON answers (session_id);
CREATE INDEX idx_answers_participant_id     ON answers (participant_id);
CREATE INDEX idx_answers_question_id        ON answers (question_id);

-- ── Functions & Triggers ────────────────────────────────────

-- Automatically update updated_at on any UPDATE
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER trg_quizzes_updated_at
    BEFORE UPDATE ON quizzes
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER trg_questions_updated_at
    BEFORE UPDATE ON questions
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- Enforce: only one active session per quiz at a time
CREATE OR REPLACE FUNCTION enforce_single_active_session()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.status IN ('waiting', 'question', 'results') THEN
        IF EXISTS (
            SELECT 1 FROM sessions
            WHERE  quiz_id = NEW.quiz_id
            AND    status IN ('waiting', 'question', 'results')
            AND    id <> NEW.id
        ) THEN
            RAISE EXCEPTION 'Quiz % already has an active session', NEW.quiz_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_single_active_session
    BEFORE INSERT OR UPDATE ON sessions
    FOR EACH ROW EXECUTE FUNCTION enforce_single_active_session();

-- Enforce: multi-choice question must have ≥ 2 correct options
--          single-choice question must have exactly 1 correct option
-- (checked at the question level after all options are inserted via app logic;
--  this function can be called from the service layer or a deferred trigger)

-- ── Views ───────────────────────────────────────────────────

-- Leaderboard for a session (top participants by score, then fastest response)
CREATE OR REPLACE VIEW v_leaderboard AS
SELECT
    p.session_id,
    p.id             AS participant_id,
    p.display_name,
    p.score,
    RANK() OVER (
        PARTITION BY p.session_id
        ORDER BY p.score DESC, AVG(a.response_time_ms) ASC NULLS LAST
    ) AS rank,
    COUNT(a.id)      AS questions_answered,
    AVG(a.response_time_ms)::INT AS avg_response_ms
FROM participants p
LEFT JOIN answers a
       ON a.participant_id = p.id
      AND a.session_id     = p.session_id
GROUP BY p.session_id, p.id, p.display_name, p.score;

-- Summary of correct/incorrect responses per question in a session
CREATE OR REPLACE VIEW v_question_results AS
SELECT
    a.session_id,
    a.question_id,
    q.body           AS question_body,
    q.position,
    COUNT(a.id)                                         AS total_answers,
    SUM(CASE WHEN a.is_correct THEN 1 ELSE 0 END)      AS correct_count,
    ROUND(
        100.0 * SUM(CASE WHEN a.is_correct THEN 1 ELSE 0 END)
              / NULLIF(COUNT(a.id), 0), 1
    )                                                   AS correct_pct,
    AVG(a.response_time_ms)::INT                        AS avg_response_ms
FROM answers a
JOIN questions q ON q.id = a.question_id
GROUP BY a.session_id, a.question_id, q.body, q.position;

-- ── Seed: demo organizer account ────────────────────────────
-- Password: "demo1234"  (bcrypt cost 10)
-- Remove this block before going to production!
INSERT INTO users (email, display_name, password_hash, role)
VALUES (
    'demo@quizplatform.dev',
    'Demo Organizer',
    '$2b$10$X7.aM3cSRFyHq0p3Pg5S7OQkXbqXiM7WxGzR5JZFiMEi4UNJZqEGm',
    'organizer'
) ON CONFLICT DO NOTHING;