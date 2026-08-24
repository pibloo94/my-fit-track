#!/bin/sh
set -eu

# Migrations are a separate step from serving traffic: if deploy fails here,
# the previous container keeps running. `migrate deploy` is idempotent.
npx prisma migrate deploy
exec node dist/main.js
