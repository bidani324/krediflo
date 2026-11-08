#!/bin/bash
set -e

pnpm install --frozen-lockfile
pnpm --filter db push-force

# connect-pg-simple manages user_sessions outside of Drizzle schema.
# Recreate it with IF NOT EXISTS so it survives push-force drops.
psql "$DATABASE_URL" -c "
  CREATE TABLE IF NOT EXISTS \"user_sessions\" (
    \"sid\" varchar NOT NULL COLLATE \"default\",
    \"sess\" json NOT NULL,
    \"expire\" timestamp(6) NOT NULL,
    CONSTRAINT \"session_pkey\" PRIMARY KEY (\"sid\")
  ) WITH (OIDS=FALSE);
  CREATE INDEX IF NOT EXISTS \"IDX_user_sessions_expire\" ON \"user_sessions\" (\"expire\");
"
