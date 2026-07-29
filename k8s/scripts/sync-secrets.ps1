# Sync Secret Manager → k8s Secret for the sparx-app-secrets bundle.
#
# Phase 1 manual sync. When this becomes painful, replace with External Secrets
# Operator (https://external-secrets.io).
#
# Usage: ./sync-secrets.ps1 -ProjectId my-gcp-project

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectId,

    [string]$Namespace = "sparx-prod",

    [string]$SecretName = "sparx-app-secrets"
)

$ErrorActionPreference = "Stop"

$secretKeys = @(
    "database-url",
    "auth-database-url",
    "redis-url",
    "better-auth-secret",
    "google-client-id",
    "google-client-secret",
    "google-oauth-client-id",
    "google-oauth-client-secret",
    "search-console-token-key",
    # Social-posting token-encryption key (docs/133 §5) — api-rest encrypts the
    # per-tenant social OAuth grants on connect. Maps to SOCIAL_TOKEN_KEY.
    "social-token-key",
    # Per-platform OAuth app credentials for the social + channels modules. An
    # adapter's `isConfigured()` is FALSE when its pair is absent, so the platform
    # silently disappears from the connect UI rather than erroring — a missing key
    # here reads as a bug in the adapter.
    #
    # These were already live in the cluster but absent from this list, which is
    # exactly the drift the guard below now refuses to act on.
    #
    # Threads uses its OWN app id + secret (from the "Access the Threads API" use
    # case), NOT the Facebook app's — graph.threads.net rejects the Meta pair.
    # Google Business Profile + YouTube deliberately share the google-oauth-* pair
    # already listed above.
    "meta-app-id",
    "meta-app-secret",
    "threads-app-id",
    "threads-app-secret",
    "linkedin-client-id",
    "linkedin-client-secret",
    "pinterest-app-id",
    "pinterest-app-secret",
    "tiktok-client-key",
    "tiktok-client-secret",
    "sparx-internal-jwt-secret",
    "stripe-secret-key",
    "stripe-webhook-secret",
    "godaddy-api-key-ote",
    "godaddy-api-secret-ote",
    "godaddy-api-key-prod",
    "godaddy-api-secret-prod",
    "postal-api-key",
    "cloudflare-api-token"
)

$literals = @()
$resolved = @()
foreach ($key in $secretKeys) {
    Write-Host "Fetching $key..."
    $value = gcloud secrets versions access latest --secret=$key --project=$ProjectId
    if ($LASTEXITCODE -ne 0) {
        Write-Warning "Skipping $key — not set in Secret Manager yet."
        continue
    }
    # Convert kebab-case secret id to SCREAMING_SNAKE_CASE env var name
    $envName = ($key -replace "-", "_").ToUpper()
    $literals += "--from-literal=${envName}=${value}"
    $resolved += $envName
}

# ── Drop guard ────────────────────────────────────────────────────────────────
# This script REPLACES the secret: delete + create writes exactly $secretKeys and
# nothing else. Any key living in the cluster but missing from that list above is
# therefore silently destroyed, and the failure lands on whichever service reads
# it — minutes later, as an unrelated-looking outage.
#
# That is not hypothetical. On 2026-07-28 the live secret carried ~30 keys this
# list had never heard of (META_APP_ID, THREADS_APP_ID, PINTEREST_*, TIKTOK_*,
# CHANNELS_TOKEN_KEY, CUSTOMER_AUTH_SECRET, PROVIDER_SECRET_KEY, every
# STRIPE_PRICE_*, the SPARX_INTERNAL_* tokens…). Running the script unchanged
# would have taken social publishing, marketplace channels, shopper login and all
# of billing down at once.
#
# So: compare first, and refuse. Add the missing ids to $secretKeys (and to Secret
# Manager) rather than deleting the guard — a key you cannot name is a key you
# cannot restore.
# Read via JSON, not go-template: a go-template's own `{{$k}}` braces and backticks
# have to survive PowerShell quoting too, and they do not do it reliably.
$existingJson = kubectl get secret $SecretName -n $Namespace -o json 2>$null | Out-String
if ($LASTEXITCODE -eq 0 -and $existingJson.Trim()) {
    $data = ($existingJson | ConvertFrom-Json).data
    $existingKeys = @($data.PSObject.Properties.Name)
    $wouldDrop = @($existingKeys | Where-Object { $resolved -notcontains $_ })
    if ($wouldDrop.Count -gt 0) {
        Write-Host ""
        Write-Error @"
ABORTED — this sync would DELETE $($wouldDrop.Count) key(s) that exist in ${SecretName}:

  $($wouldDrop -join "`n  ")

They are in the cluster but not in `$secretKeys, so the delete+create below would
drop them. Add each one to `$secretKeys (and confirm it exists in Secret Manager),
then re-run. Nothing has been changed.
"@
        exit 1
    }
}

Write-Host "Recreating $SecretName in namespace $Namespace..."
kubectl delete secret $SecretName -n $Namespace --ignore-not-found
kubectl create secret generic $SecretName -n $Namespace @literals

# Restart EVERY tier that mounts sparx-app-secrets via envFrom. `tier=web` (the
# dashboard) is easy to forget but MUST be included: Better Auth staff login runs
# in the dashboard and reads GOOGLE_CLIENT_ID/SECRET from this bundle, so omitting
# it leaves the dashboard serving a stale client_id → Google "invalid_client".
Write-Host "Restarting web + app + worker Deployments to pick up new values..."
kubectl rollout restart deployment -n $Namespace -l tier=web
kubectl rollout restart deployment -n $Namespace -l tier=api
kubectl rollout restart deployment -n $Namespace -l tier=worker

Write-Host "Done."
