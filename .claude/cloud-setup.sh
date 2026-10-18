#!/bin/bash
# Gets a Claude Code cloud session (claude.ai/code or the Claude app) ready to work on UniSwap.
# The SessionStart hook in .claude/settings.json runs it whenever a session starts or resumes.
# On a laptop it does nothing: the cloud sets CLAUDE_CODE_REMOTE=true, a local session never does.
#
# A cloud session is a fresh Ubuntu machine with Node.js 22 and PostgreSQL 16 installed, but no
# database running, no node_modules and no backend/.env (git ignores it). This script:
#   1. installs the npm packages in backend/ and frontend/ (skipped while already up to date),
#      and generates Next.js's route types so `npx tsc --noEmit` works
#   2. starts PostgreSQL and creates the uniswap and uniswap_test databases
#   3. writes backend/.env from .env.example, with a random JWT_SECRET
#   4. creates the tables and demo data, the first time only
# No real key or password is needed: email, Stripe, Cloudinary, Telegram and Bakong stay off,
# and the cloud's network could not reach them anyway. Whatever it prints, Claude reads.

if [ "$CLAUDE_CODE_REMOTE" != "true" ]; then
  exit 0
fi

cd "$(dirname "$0")/.." || exit 0
LOG=/tmp/uniswap-cloud-setup.log
problems=()

# 1. npm writes node_modules/.package-lock.json at the end of a successful install, so it is
#    newer than package-lock.json unless the install never finished or the lockfile changed since.
for app in backend frontend; do
  if [ ! "$app/node_modules/.package-lock.json" -nt "$app/package-lock.json" ]; then
    (cd "$app" && npm ci --no-audit --no-fund) >>"$LOG" 2>&1 || problems+=("npm ci in $app/")
  fi
done
# Next.js generates the PageProps types into .next/ (git-ignored); without them `tsc` fails.
if [ ! -f frontend/.next/types/routes.d.ts ]; then
  (cd frontend && npx next typegen) >>"$LOG" 2>&1 || problems+=("next typegen in frontend/")
fi

# 2. The password "postgres" matches DATABASE_URL in backend/.env.example. This database only
#    lives as long as the cloud machine, so it never holds real data.
service postgresql start >>"$LOG" 2>&1
su postgres -c "psql -q -c \"ALTER USER postgres PASSWORD 'postgres'\"" >>"$LOG" 2>&1 \
  || problems+=("starting PostgreSQL")
for db in uniswap uniswap_test; do
  su postgres -c "createdb $db" >>"$LOG" 2>&1 || true # fails harmlessly when it already exists
done

# 3. The defaults in .env.example already fit the cloud (local database, every optional service
#    empty), except JWT_SECRET, which gets a fresh random value.
if [ ! -f backend/.env ]; then
  sed "s/^JWT_SECRET=.*/JWT_SECRET=$(openssl rand -hex 32)/" backend/.env.example > backend/.env
fi

# 4. db:setup wipes the database, so it only runs while the users table does not exist yet.
if [ -z "$(su postgres -c "psql -d uniswap -tAc \"SELECT to_regclass('public.users')\"" 2>>"$LOG")" ]; then
  (cd backend && npm run db:setup && npm run db:seed) >>"$LOG" 2>&1 \
    || problems+=("creating the tables and demo data")
fi

if [ ${#problems[@]} -eq 0 ]; then
  echo "UniSwap cloud setup is ready: npm packages, backend/.env, and PostgreSQL running with the"
  echo "uniswap (demo data) and uniswap_test databases. Email, Stripe, Cloudinary, Telegram and"
  echo "Bakong are off here. Check with: cd backend && npm test && npm run test:api"
else
  echo "UniSwap cloud setup had problems with: ${problems[*]}. Details are in $LOG."
fi
exit 0
