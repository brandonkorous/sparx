# Builds every image the local k8s overlay needs, straight into Docker
# Desktop's image store. Its Kubernetes shares that store, so there is no
# registry, no push, and no pull — which is why k8s/local/kustomization.yaml
# pins `imagePullPolicy: Never`.
#
#   pwsh scripts/build-local-images.ps1              # everything (19 images)
#   pwsh scripts/build-local-images.ps1 -Only api-rest,web
#   pwsh scripts/build-local-images.ps1 -Throttle 2  # if the machine is busy
#
# Every Dockerfile COPYs from the workspace root (pnpm-workspace.yaml, the
# packages/* closure), so the build context is ALWAYS the repo root and -f
# selects the Dockerfile. Building from inside a service directory fails on the
# first COPY.
[CmdletBinding()]
param(
    # Build only these targets (by image name). Default: all.
    [string[]]$Only,

    # Concurrent builds. Docker layer-caches per build, so parallel builds of
    # images sharing base layers duplicate some work on a cold cache; 4 is a
    # good balance on a many-core workstation. Drop to 1 to serialise.
    [int]$Throttle = 4,

    # Skip images that already exist. Useful when one build failed and the rest
    # succeeded.
    [switch]$SkipExisting
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot

# name → Dockerfile path, relative to the repo root.
$targets = [ordered]@{
    # Apps + APIs (k8s/apps)
    'api-rest'                = 'services/api-rest/Dockerfile'
    'api-graphql'             = 'services/api-graphql/Dockerfile'
    'api-mcp'                 = 'services/api-mcp/Dockerfile'
    'mcp-site'                = 'services/mcp-site/Dockerfile'
    'workbench'               = 'apps/workbench/Dockerfile'
    'web'                     = 'apps/web/Dockerfile'
    'site'                    = 'apps/site/Dockerfile'
    'market'                  = 'apps/market/Dockerfile'
    # Workers, formerly Cloud Run (k8s/self-hosted/workers.yaml)
    'email-worker'            = 'services/email-worker/Dockerfile'
    'push-worker'             = 'services/push-worker/Dockerfile'
    'markup-recompute-worker' = 'services/markup-recompute-worker/Dockerfile'
    'media-worker'            = 'services/media-worker/Dockerfile'
    'commerce-indexer'        = 'services/commerce-indexer/Dockerfile'
    'channel-sync-worker'     = 'services/channel-sync-worker/Dockerfile'
    'social-worker'           = 'services/social-worker/Dockerfile'
    'legal-seed-worker'       = 'services/legal-seed-worker/Dockerfile'
    'platform-crm-worker'     = 'services/platform-crm-worker/Dockerfile'
    'domain-worker'           = 'services/domain-worker/Dockerfile'
    'dropship-worker'         = 'services/dropship-worker/Dockerfile'
    # Migration runner — invoked as a one-off Job by scripts/local-up.ps1.
    'db'                      = 'packages/db/Dockerfile'
}

if ($Only) {
    $unknown = $Only | Where-Object { -not $targets.Contains($_) }
    if ($unknown) {
        throw "Unknown target(s): $($unknown -join ', ')`nValid: $($targets.Keys -join ', ')"
    }
    $selected = [ordered]@{}
    foreach ($k in $Only) { $selected[$k] = $targets[$k] }
    $targets = $selected
}

if ($SkipExisting) {
    $existing = (docker images --format '{{.Repository}}:{{.Tag}}') -split "`n"
    $filtered = [ordered]@{}
    foreach ($k in $targets.Keys) {
        if ($existing -contains "sparx/${k}:local") {
            Write-Host "skip   $k (already built)" -ForegroundColor DarkGray
        }
        else { $filtered[$k] = $targets[$k] }
    }
    $targets = $filtered
}

if ($targets.Count -eq 0) { Write-Host 'Nothing to build.'; return }

$logDir = Join-Path $env:TEMP "sparx-local-build"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

Write-Host "Building $($targets.Count) image(s), $Throttle at a time." -ForegroundColor Cyan
Write-Host "Logs: $logDir" -ForegroundColor DarkGray
$started = Get-Date

# Full docker output goes to a per-image log rather than the console: with
# parallel builds the interleaved streams are unreadable, and on failure the log
# is what you actually want to look at.
$results = $targets.GetEnumerator() | ForEach-Object -ThrottleLimit $Throttle -Parallel {
    $name = $_.Key
    $dockerfile = $_.Value
    $root = $using:repoRoot
    $log = Join-Path $using:logDir "$name.log"

    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    Write-Host "build  $name ..." -ForegroundColor DarkGray

    # 2>&1 keeps BuildKit's progress stream (which it writes to stderr) in the
    # log instead of surfacing it as a PowerShell error record.
    docker build --file (Join-Path $root $dockerfile) --tag "sparx/${name}:local" $root *> $log
    $ok = $LASTEXITCODE -eq 0
    $sw.Stop()

    if ($ok) {
        Write-Host ("  ok   {0} ({1:N0}s)" -f $name, $sw.Elapsed.TotalSeconds) -ForegroundColor Green
    }
    else {
        Write-Host ("  FAIL {0} ({1:N0}s) → {2}" -f $name, $sw.Elapsed.TotalSeconds, $log) -ForegroundColor Red
    }

    [pscustomobject]@{ Name = $name; Ok = $ok; Seconds = $sw.Elapsed.TotalSeconds; Log = $log }
}

$failed = @($results | Where-Object { -not $_.Ok })
Write-Host ''
Write-Host ("Done in {0:N0}s — {1} ok, {2} failed." -f ((Get-Date) - $started).TotalSeconds,
    ($results.Count - $failed.Count), $failed.Count) -ForegroundColor Cyan

if ($failed.Count -gt 0) {
    Write-Host ''
    foreach ($f in $failed) {
        Write-Host "  $($f.Name) → $($f.Log)" -ForegroundColor Red
        # The last few lines are almost always the actual error.
        Get-Content $f.Log -Tail 12 | ForEach-Object { Write-Host "      $_" -ForegroundColor DarkRed }
    }
    exit 1
}
