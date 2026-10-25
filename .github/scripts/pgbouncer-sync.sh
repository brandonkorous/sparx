#!/usr/bin/env bash
# SI-1: write the pgbouncer-config Secret, and point DATABASE_URL at PgBouncer when PGBOUNCER_ENABLED=true.
# Usage: pgbouncer-sync.sh <app-env-file>   (needs NAMESPACE; edits the env file in place)
set -euo pipefail

ENV_FILE=$1
DIR=$(mktemp -d)
trap 'rm -rf "$DIR"' EXIT

# Built from the DIRECT DATABASE_URL, so the userlist always matches the password the apps use.
node scripts/pgbouncer-config.mjs files "$ENV_FILE" "$DIR"

secret_hash() {
  kubectl get secret pgbouncer-config -n "$NAMESPACE" -o jsonpath='{.data}' 2>/dev/null | sha256sum | cut -d' ' -f1 || true
}

BEFORE=$(secret_hash)
kubectl create secret generic pgbouncer-config -n "$NAMESPACE" \
  --from-file=pgbouncer.ini="$DIR/pgbouncer.ini" \
  --from-file=userlist.txt="$DIR/userlist.txt" \
  --dry-run=client -o yaml | kubectl apply -f -
AFTER=$(secret_hash)

# PgBouncer reads its config once at start, so a changed Secret has to roll it.
if [ "$BEFORE" != "$AFTER" ] && kubectl get deployment pgbouncer -n "$NAMESPACE" >/dev/null 2>&1; then
  kubectl rollout restart deployment/pgbouncer -n "$NAMESPACE"
  echo "pgbouncer-config changed; restarted PgBouncer."
fi

if [ "${PGBOUNCER_ENABLED:-}" != "true" ]; then
  echo "PGBOUNCER_ENABLED is not 'true': DATABASE_URL stays direct to Postgres."
  exit 0
fi

POOLED=$(node scripts/pgbouncer-config.mjs pooled-url "$ENV_FILE" "pgbouncer.$NAMESPACE.svc.cluster.local")
echo "::add-mask::$POOLED"
grep -v '^DATABASE_URL=' "$ENV_FILE" > "$DIR/app.env"
printf 'DATABASE_URL=%s\n' "$POOLED" >> "$DIR/app.env"
cp "$DIR/app.env" "$ENV_FILE"
echo "PGBOUNCER_ENABLED=true: DATABASE_URL now points at PgBouncer."
