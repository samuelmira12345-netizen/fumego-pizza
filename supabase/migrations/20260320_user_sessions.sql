-- P8: Token revocation via user_sessions table
-- Each JWT issued to a user stores a unique jti (JWT ID) here.
-- On logout or forced revocation, the row is deleted; the API routes
-- verify the jti exists before accepting the token.

CREATE TABLE IF NOT EXISTS user_sessions (
  jti        UUID PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id  ON user_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires  ON user_sessions (expires_at);

ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service role only" ON user_sessions;
CREATE POLICY "service role only" ON user_sessions
  USING (false) WITH CHECK (false);

-- Clean up expired sessions (run periodically or via cron)
-- DELETE FROM user_sessions WHERE expires_at < NOW();
