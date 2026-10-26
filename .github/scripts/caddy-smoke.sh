#!/usr/bin/env bash
# SI-4: validate the real Caddyfile, then prove the shared header snippets do what they claim.
# Runs Caddy from the pinned image (CI) or a local binary: CADDY_BIN=/path/to/caddy bash .github/scripts/caddy-smoke.sh
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/../.." && pwd)
IMAGE=$(grep -m1 -oE 'image: caddy:[0-9.]+-alpine' "$ROOT/k8s/ingress/deployment.yaml" | cut -d' ' -f2)
WORK=$(mktemp -d)
command -v cygpath >/dev/null 2>&1 && WORK=$(cygpath -m "$WORK")
trap 'docker rm -f caddy-smoke >/dev/null 2>&1 || true; [ -n "${PID:-}" ] && kill "$PID" 2>/dev/null; rm -rf "$WORK"' EXIT

caddy() {
  if [ -n "${CADDY_BIN:-}" ]; then (cd "$WORK" && "$CADDY_BIN" "$@"); else docker run --rm --network host -v "$WORK:$WORK" -w "$WORK" "$IMAGE" caddy "$@"; fi
}

# 1. The whole routing table loads, with a throwaway cert where the admin Origin CA cert would be mounted.
cp "$ROOT/k8s/ingress/Caddyfile" "$WORK/Caddyfile"
MSYS_NO_PATHCONV=1 openssl req -x509 -newkey rsa:2048 -nodes -days 1 -subj "/CN=smoke" -keyout "$WORK/tls.key" -out "$WORK/tls.crt" 2>/dev/null
sed "s#/certs/admin/tls.crt /certs/admin/tls.key#$WORK/tls.crt $WORK/tls.key#" "$ROOT/k8s/ingress/mode.caddy" > "$WORK/mode.caddy"
caddy validate --config Caddyfile --adapter caddyfile

# 2. The snippets alone, in front of an echo upstream on plain HTTP.
{
  printf '{\n\tadmin off\n\tauto_https off\n}\n'
  awk '/^\(edge_request\) \{/{p=1} /^# ----- Platform hostnames/{p=0} p' "$ROOT/k8s/ingress/Caddyfile"
  cat <<'EOF'
http://:18081 {
	header Content-Type "text/html; charset=utf-8"
	respond "sub=[{header.X-Middleware-Subrequest}] ip=[{header.X-Client-IP}] {header.X-Pad}"
}
http://piggles.localhost:18080 {
	import piggles_headers
	reverse_proxy 127.0.0.1:18081
}
http://tenant.localhost:18080 {
	import tenant_headers
	reverse_proxy 127.0.0.1:18081
}
EOF
} > "$WORK/Smoke.caddy"

if [ -n "${CADDY_BIN:-}" ]; then
  "$CADDY_BIN" run --config "$WORK/Smoke.caddy" --adapter caddyfile >/dev/null 2>&1 & PID=$!
else
  docker run -d --name caddy-smoke --network host -v "$WORK:$WORK" -w "$WORK" "$IMAGE" caddy run --config Smoke.caddy --adapter caddyfile >/dev/null
fi
for _ in $(seq 1 30); do curl -s -o /dev/null http://127.0.0.1:18081/ && break; sleep 1; done

PAD=$(head -c 2000 /dev/zero | tr '\0' x)
HEADERS=$(curl -s -D - -o "$WORK/body" -H 'Host: piggles.localhost' -H 'Accept-Encoding: gzip' \
  -H 'X-Middleware-Subrequest: middleware:middleware' -H 'X-Client-IP: 6.6.6.6' -H "X-Pad: $PAD" http://127.0.0.1:18080/ | tr -d '\r')
BODY=$(gzip -dc "$WORK/body")
TENANT=$(curl -s -D - -o /dev/null -H 'Host: tenant.localhost' http://127.0.0.1:18080/ | tr -d '\r')

fail() { echo "caddy-smoke: $1" >&2; exit 1; }
grep -qi '^content-encoding: gzip' <<<"$HEADERS" || fail 'text response was not compressed'
grep -qi '^strict-transport-security: max-age=31536000; includeSubDomains' <<<"$HEADERS" || fail 'owned host HSTS lacks includeSubDomains'
grep -qi '^x-frame-options: DENY' <<<"$HEADERS" || fail 'Piggles is not X-Frame-Options DENY'
grep -qi '^content-security-policy-report-only:' <<<"$HEADERS" || fail 'Piggles has no report-only CSP'
grep -q 'sub=\[\]' <<<"$BODY" || fail 'x-middleware-subrequest reached the upstream'
grep -q 'ip=\[127.0.0.1\]' <<<"$BODY" || fail 'a client-sent X-Client-IP reached the upstream'
grep -qi '^strict-transport-security: max-age=31536000$' <<<"$TENANT" || fail 'tenant HSTS must not include subdomains'
echo 'caddy-smoke: Caddyfile valid; compression, header strip, HSTS, framing and CSP all hold.'
