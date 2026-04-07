ALTER TABLE participants
  ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX idx_participants_user_id ON participants(user_id);

COMMENT ON COLUMN participants.user_id IS
  'NULL for anonymous participants. Set when a logged-in user joins a session.';