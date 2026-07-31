# Brings the local self-hosted stack up on Docker Desktop's Kubernetes.
#
#   pwsh scripts/local-up.ps1                 # secrets + apply
#   pwsh scripts/local-up.ps1 -Migrate        # ... and run DB migrations
#   pwsh scripts/local-up.ps1 -SecretsOnly    # just re-sync secrets
#
# Prerequisites, in order:
#   1. Docker Desktop → Settings → Kubernetes → Enable Kubernetes
#   2. pwsh scripts/build-local-images.ps1
#   3. cp k8s/local/secrets.example.env k8s/local/secrets.env  and fill it in
#   4. A Cloudflare tunnel:
#        cloudflared tunnel login
#        cloudflared tunnel create sparx-local
#      That writes <UUID>.json into ~/.cloudflared. Pass it with -TunnelCredentials
#      (or drop it at k8s/local/tunnel-credentials.json, which is gitignored).
#
# Full runbook + the DNS records you still have to point: k8s/local/README.md
[CmdletBinding()]
param(
    # The overlay applies into the `sparx-prod` namespace ON PURPOSE (see
    # k8s/local/kustomization.yaml). That makes applying to the wrong cluster
    # genuinely destructive, so the context is checked rather than assumed.
    [string]$KubeContext = 'docker-desktop',

    [string]$SecretsFile,
    [string]$TunnelCredentials,

    # Run `prisma migrate deploy` (via the db image's run-migrations entrypoint)
    # as a one-off Job once Postgres is ready. Opt-in: applying schema changes
    # should be a deliberate act, never a side effect of bringing pods up.
    [switch]$Migrate,

    [switch]$SecretsOnly
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$localDir = Join-Path $repoRoot 'k8s/local'
$ns = 'sparx-prod'

if (-not $SecretsFile) { $SecretsFile = Join-Path $localDir 'secrets.env' }
if (-not $TunnelCredentials) { $TunnelCredentials = Join-Path $localDir 'tunnel-credentials.json' }

# --- Preflight -------------------------------------------------------------
$current = (kubectl config current-context).Trim()
if ($current -ne $KubeContext) {
    throw @"
Refusing to apply: kubectl context is '$current', expected '$KubeContext'.

This overlay uses the `sparx-prod` namespace, so applying it to a real cluster
would overwrite production workloads. Switch with:
    kubectl config use-context $KubeContext
or pass -KubeContext '$current' if you are certain.
"@
}

if (-not (Test-Path $SecretsFile)) {
    throw "Missing $SecretsFile — copy k8s/local/secrets.example.env and fill it in."
}

# --- Parse secrets.env -----------------------------------------------------
# Deliberately hand-parsed rather than piped straight to `--from-env-file`:
# kubectl accepts blank values silently, and a blank SPARX_INTERNAL_CRON_TOKEN
# or DATABASE_URL produces pods that start cleanly and then fail at the first
# request. Better to refuse now and name the keys.
$secrets = @{}
$blank = @()
foreach ($line in Get-Content $SecretsFile) {
    $t = $line.Trim()
    if (-not $t -or $t.StartsWith('#')) { continue }
    $i = $t.IndexOf('=')
    if ($i -lt 1) { continue }
    $k = $t.Substring(0, $i).Trim()
    $v = $t.Substring($i + 1).Trim()
    if (-not $v) { $blank += $k; continue }
    $secrets[$k] = $v
}

# Without these the stack comes up broken in ways that are annoying to diagnose.
$required = @('DATABASE_URL', 'AUTH_DATABASE_URL', 'BETTER_AUTH_SECRET',
    'CUSTOMER_AUTH_SECRET', 'SPARX_INTERNAL_JWT_SECRET',
    'SPARX_INTERNAL_CRON_TOKEN', 'TYPESENSE_API_KEY')
$missing = $required | Where-Object { -not $secrets.ContainsKey($_) }
if ($missing) {
    throw "These are required but blank in ${SecretsFile}:`n  $($missing -join "`n  ")"
}
if ($blank) {
    Write-Host "Blank (skipped — fine if you don't use that integration):" -ForegroundColor DarkYellow
    Write-Host "  $($blank -join ', ')" -ForegroundColor DarkGray
}

# --- Namespace + secrets ---------------------------------------------------
# `create --dry-run | apply` is the idempotent form: plain `create` fails on a
# rerun, and `apply` alone cannot build a Secret from literals.
kubectl create namespace $ns --dry-run=client -o yaml | kubectl apply -f - | Out-Null

$literals = $secrets.GetEnumerator() | ForEach-Object { "--from-literal=$($_.Key)=$($_.Value)" }
kubectl create secret generic sparx-app-secrets -n $ns @literals --dry-run=client -o yaml |
    kubectl apply -f - | Out-Null
Write-Host "secret  sparx-app-secrets ($($secrets.Count) keys)" -ForegroundColor Green

# Typesense reads its key from a SEPARATE secret, because that is what the base
# manifests' secretKeyRef points at (k8s/apps/api-rest.yaml). Same value.
kubectl create secret generic typesense-secrets -n $ns `
    "--from-literal=api-key=$($secrets['TYPESENSE_API_KEY'])" `
    --dry-run=client -o yaml | kubectl apply -f - | Out-Null
Write-Host 'secret  typesense-secrets' -ForegroundColor Green

# --- Postgres bootstrap SQL ------------------------------------------------
# Built here rather than by kustomize's configMapGenerator: the source lives at
# packages/db/docker/init, outside k8s/local, and kustomize will not read a file
# outside its own directory. Pointing at the real path keeps ONE definition of
# the `sparx_app` / `wize_operator` roles shared with the `pnpm db:up` compose
# stack — a copy inside k8s/local would silently drift the day either changes.
$initDir = Join-Path $repoRoot 'packages/db/docker/init'
$initArgs = Get-ChildItem $initDir -Filter '*.sql' | ForEach-Object { "--from-file=$($_.FullName)" }
if (-not $initArgs) { throw "No .sql files in $initDir — Postgres would start with no app roles." }
kubectl create configmap postgres-init -n $ns @initArgs --dry-run=client -o yaml |
    kubectl apply -f - | Out-Null
Write-Host "config  postgres-init ($($initArgs.Count) file(s))" -ForegroundColor Green

# --- Cloudflare tunnel config ---------------------------------------------
if (Test-Path $TunnelCredentials) {
    $tunnelId = (Get-Content $TunnelCredentials -Raw | ConvertFrom-Json).TunnelID
    if (-not $tunnelId) { throw "$TunnelCredentials has no TunnelID — is it a tunnel credentials file?" }

    kubectl create secret generic cloudflared-credentials -n $ns `
        "--from-file=credentials.json=$TunnelCredentials" `
        --dry-run=client -o yaml | kubectl apply -f - | Out-Null

    # One catch-all ingress rule. Caddy already routes by Host header, so
    # cloudflared stays a dumb pipe — see k8s/self-hosted/cloudflared.yaml.
    # The 404 rule is required: cloudflared refuses to start without a final
    # catch-all, and this one is unreachable behind the rule above it.
    $cfConfig = @"
tunnel: $tunnelId
credentials-file: /etc/cloudflared/creds/credentials.json
no-autoupdate: true
ingress:
  - service: http://caddy.$ns.svc.cluster.local:80
  - service: http_status:404
"@
    $tmp = Join-Path $env:TEMP 'cloudflared-config.yaml'
    Set-Content -Path $tmp -Value $cfConfig -NoNewline
    kubectl create configmap cloudflared-config -n $ns "--from-file=config.yaml=$tmp" `
        --dry-run=client -o yaml | kubectl apply -f - | Out-Null
    Remove-Item $tmp
    Write-Host "tunnel  $tunnelId" -ForegroundColor Green
}
else {
    Write-Host "tunnel  SKIPPED — no $TunnelCredentials" -ForegroundColor DarkYellow
    Write-Host '        cloudflared will stay Pending until it exists. Everything' -ForegroundColor DarkGray
    Write-Host '        else runs; reach it with `kubectl port-forward svc/caddy 8080:80`.' -ForegroundColor DarkGray
}

if ($SecretsOnly) { return }

# --- Apply -----------------------------------------------------------------
Write-Host ''
Write-Host 'Applying k8s/local ...' -ForegroundColor Cyan
kubectl apply -k $localDir
if ($LASTEXITCODE -ne 0) { throw 'kubectl apply failed.' }

# --- Migrations ------------------------------------------------------------
if ($Migrate) {
    Write-Host ''
    Write-Host 'Waiting for Postgres ...' -ForegroundColor Cyan
    kubectl wait --for=condition=ready pod -l app=postgres -n $ns --timeout=300s
    if ($LASTEXITCODE -ne 0) { throw 'Postgres never became ready.' }

    # generateName so repeated runs do not collide with a completed Job, and
    # ttlSecondsAfterFinished so they clean themselves up.
    $jobYaml = @"
apiVersion: batch/v1
kind: Job
metadata:
  generateName: db-migrate-
  namespace: $ns
spec:
  backoffLimit: 0
  ttlSecondsAfterFinished: 600
  template:
    spec:
      restartPolicy: Never
      enableServiceLinks: false
      containers:
        - name: migrate
          image: sparx/db:local
          imagePullPolicy: Never
          envFrom:
            - configMapRef: { name: sparx-app-env }
            - secretRef: { name: sparx-app-secrets }
          env:
            # Migrations and the hand-edited RLS SQL run as the OWNER role,
            # not the RLS-constrained sparx_app the apps use.
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef: { name: sparx-app-secrets, key: AUTH_DATABASE_URL }
"@
    $job = ($jobYaml | kubectl create -f - -o name)
    if ($LASTEXITCODE -ne 0) { throw 'Could not create the migration Job.' }
    Write-Host "Running $job ..." -ForegroundColor Cyan
    kubectl wait --for=condition=complete $job -n $ns --timeout=900s
    if ($LASTEXITCODE -ne 0) {
        kubectl logs $job -n $ns --tail=50
        throw 'Migration Job failed — logs above.'
    }
    kubectl logs $job -n $ns --tail=20
}

Write-Host ''
Write-Host 'Applied. Watch it settle with:' -ForegroundColor Cyan
Write-Host "    kubectl get pods -n $ns -w" -ForegroundColor White
if (-not $Migrate) {
    Write-Host 'Schema not applied yet — rerun with -Migrate once the images are built.' -ForegroundColor DarkYellow
}
