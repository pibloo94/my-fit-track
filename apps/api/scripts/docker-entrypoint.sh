#!/bin/sh
set -eu

# Migrations are not run here. CI applies them before the new image is deployed
# (ADR-015): a scale-to-zero instance would otherwise re-run them on every wake.
exec node dist/main.js
