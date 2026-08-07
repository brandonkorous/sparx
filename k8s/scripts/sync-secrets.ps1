# Load the `sparx-app-secrets` bundle into Azure Key Vault.
#
# THIS SCRIPT DOES NOT TOUCH THE CLUSTER. That is the difference from the GCP
# version it replaces, which fetched from Secret Manager and then recreated the
# k8s Secret by hand — a hand-run step that could silently drop keys, and did.
# The release pipeline now reads the vault on every run (release.yml, "Sync
# secrets"), so the only thing left for a human to do is put values IN.
#
# WHY THE VAULT EXISTS. Secrets used to live in one GitHub repo secret,
# `SPARX_APP_SECRETS_ENV`, holding the whole bundle as a dotenv blob. GitHub
# secrets are WRITE ONLY — there is no API to read one back — so adding a single
# key meant reconstructing all ~30 from a copy kept somewhere else, and
# `gh secret set` REPLACES rather than merges. One typo was a platform outage on
# the next release. In Key Vault each secret is its own readable, versioned
# object, so adding one is a single command and nothing else moves.
#
# USAGE
#
#   # Seed the vault from your existing dotenv blob (the migration, run once):
#   ./sync-secrets.ps1 -VaultName kv-sparx-prod-cus -FromEnvFile ..\local\secrets.env
#
#   # Set or rotate one value afterwards (the steady state):
#   az keyvault secret set --vault-name kv-sparx-prod-cus `
#     --name crm-voice-token-key --value <value>
#
#   # See what is there (names only — values need an explicit `secret show`):
#   ./sync-secrets.ps1 -VaultName kv-sparx-prod-cus -List
#
# The vault, and the roles that let you write to it, come from
# terraform/bootstrap-azure. Being subscription Owner does NOT grant data-plane
# access — if `az keyvault secret set` returns 403, the missing piece is the
# `Key Vault Secrets Officer` assignment that module makes.

[CmdletBinding(DefaultParameterSetName = 'Load')]
param(
    [Parameter(Mandatory = $true)]
    [string]$VaultName,

    # A dotenv file — the same shape as the SPARX_APP_SECRETS_ENV blob, or
    # k8s/local/secrets.example.env filled in.
    [Parameter(Mandatory = $true, ParameterSetName = 'Load')]
    [string]$FromEnvFile,

    [Parameter(Mandatory = $true, ParameterSetName = 'List')]
    [switch]$List,

    # Show what would be written without writing it.
    [Parameter(ParameterSetName = 'Load')]
    [switch]$WhatIfOnly
)

$ErrorActionPreference = "Stop"

# ── Name mapping ─────────────────────────────────────────────────────────────
# Key Vault secret names allow ONLY [0-9a-zA-Z-]. Env names are SCREAMING_SNAKE
# and never contain a hyphen, so underscore <-> hyphen round-trips with nothing
# to disambiguate. release.yml reverses this with `tr 'a-z-' 'A-Z_'`; the two
# must agree exactly or a secret silently arrives under the wrong env name.
function ConvertTo-VaultName([string]$EnvName) {
    return $EnvName.Replace('_', '-').ToLowerInvariant()
}

function ConvertTo-EnvName([string]$VaultSecretName) {
    return $VaultSecretName.Replace('-', '_').ToUpperInvariant()
}

if ($List) {
    Write-Host "Enabled secrets in $VaultName" -ForegroundColor Cyan
    $names = az keyvault secret list --vault-name $VaultName `
        --query "[?attributes.enabled].name" -o tsv
    if ($LASTEXITCODE -ne 0) { throw "Could not list secrets in $VaultName." }
    if (-not $names) {
        Write-Warning "The vault holds no enabled secrets. The release will FAIL rather than fall back if AZURE_KEY_VAULT_NAME is set."
        return
    }
    $names -split "`n" | Where-Object { $_ } | Sort-Object | ForEach-Object {
        "{0,-40} -> {1}" -f $_.Trim(), (ConvertTo-EnvName $_.Trim())
    }
    return
}

if (-not (Test-Path $FromEnvFile)) {
    throw "No such file: $FromEnvFile"
}

# ── Parse the dotenv ─────────────────────────────────────────────────────────
# Deliberately strict and line-oriented, matching what `--from-env-file` in the
# release accepts today. A value spanning multiple lines is NOT supported here
# for the same reason it never worked in the repo blob — and unlike the blob,
# the vault CAN hold one, so the fix is `az keyvault secret set --file`, not a
# cleverer parser here.
#
# NOTE ON TRAILING WHITESPACE. `OPERATOR_AUTH_SECRET` genuinely ends with a
# carriage return and Better Auth uses the secret's exact bytes as key material,
# so trimming it breaks every operator's 2FA and their backup codes. The blob
# carries such values base64-encoded under a `_B64` suffix precisely because a
# text format cannot be trusted with them; that convention is PRESERVED end to
# end — `FOO_B64` becomes the vault secret `foo-b64` and the release grafts it
# into the Secret's `data` field without any text tool touching it. So: do not
# "helpfully" un-base64 those entries on the way in.
$lines = Get-Content -LiteralPath $FromEnvFile
$pairs = [ordered]@{}
$lineNo = 0
foreach ($line in $lines) {
    $lineNo++
    if ($line -match '^\s*($|#)') { continue }
    $eq = $line.IndexOf('=')
    if ($eq -lt 1) {
        Write-Warning "Line ${lineNo}: no '=', skipping: $line"
        continue
    }
    $name = $line.Substring(0, $eq).Trim()
    $value = $line.Substring($eq + 1)
    if ($name -notmatch '^[A-Za-z_][A-Za-z0-9_]*$') {
        Write-Warning "Line ${lineNo}: '$name' is not a valid env name, skipping."
        continue
    }
    if ([string]::IsNullOrEmpty($value)) {
        # An empty value in the template means "not filled in yet". Writing it
        # would create a secret that exists and is blank, which reads as
        # configured and behaves as absent — the worst of both.
        Write-Warning "Skipping ${name}: no value set."
        continue
    }
    $pairs[$name] = $value
}

if ($pairs.Count -eq 0) {
    throw "No usable KEY=value lines in $FromEnvFile."
}

Write-Host "Parsed $($pairs.Count) value(s) from $FromEnvFile." -ForegroundColor Cyan

if ($WhatIfOnly) {
    Write-Host "`n-WhatIfOnly: nothing will be written.`n" -ForegroundColor Yellow
    foreach ($name in $pairs.Keys) {
        "{0,-40} -> {1}" -f $name, (ConvertTo-VaultName $name)
    }
    return
}

# ── Write ────────────────────────────────────────────────────────────────────
# One secret per value, set individually. A failure part-way leaves the vault
# partially loaded, which is safe: the release only switches to the vault when
# AZURE_KEY_VAULT_NAME is set, and the instruction is to set that LAST.
#
# Values go via a temp FILE rather than --value, so a leading dash, an embedded
# quote or a trailing carriage return reaches Azure as itself instead of being
# re-parsed by PowerShell's native-argument handling.
$written = 0
$failed = @()
$tmp = [System.IO.Path]::GetTempFileName()
try {
    foreach ($name in $pairs.Keys) {
        $vaultName = ConvertTo-VaultName $name
        # No BOM, no added newline — WriteAllText with a UTF8Encoding($false).
        [System.IO.File]::WriteAllText($tmp, $pairs[$name], (New-Object System.Text.UTF8Encoding($false)))
        az keyvault secret set --vault-name $VaultName --name $vaultName `
            --file $tmp --output none 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0) {
            Write-Warning "FAILED: $name -> $vaultName"
            $failed += $name
            continue
        }
        Write-Host "  set $vaultName" -ForegroundColor DarkGray
        $written++
    }
}
finally {
    Remove-Item $tmp -Force -ErrorAction SilentlyContinue
}

Write-Host "`nWrote $written secret(s) to $VaultName." -ForegroundColor Green
if ($failed.Count -gt 0) {
    Write-Error "$($failed.Count) secret(s) failed: $($failed -join ', ')"
    exit 1
}

# ── Verify the round-trip ────────────────────────────────────────────────────
# Reads each value BACK and compares it to what was parsed. This is the whole
# point of doing the migration with a script: the failure that matters is not a
# refused write, it is a value that arrives subtly different — a trimmed
# carriage return, a mangled quote — and then breaks 2FA or webhook signature
# verification weeks later with nothing pointing at this step.
Write-Host "`nVerifying round-trip..." -ForegroundColor Cyan
$mismatched = @()
foreach ($name in $pairs.Keys) {
    $vaultName = ConvertTo-VaultName $name
    $readBack = az keyvault secret show --vault-name $VaultName --name $vaultName `
        --query value -o tsv 2>$null
    # -o tsv strips the trailing newline the CLI adds, but it also strips a
    # trailing newline that is part of the VALUE. Compare on TrimEnd("`n") both
    # sides so the check does not fail on an artefact of its own reading.
    if ($null -eq $readBack) { $mismatched += $name; continue }
    if ($readBack.TrimEnd("`r", "`n") -ne $pairs[$name].TrimEnd("`r", "`n")) {
        $mismatched += $name
    }
}

if ($mismatched.Count -gt 0) {
    Write-Warning "These did not read back identically (ignoring trailing newline): $($mismatched -join ', ')"
    Write-Warning "Check them by hand before setting AZURE_KEY_VAULT_NAME. Values with leading/trailing whitespace belong in the vault base64-encoded under a '-b64' name."
}
else {
    Write-Host "All $($pairs.Count) value(s) read back identically." -ForegroundColor Green
}

Write-Host @"

NEXT
  1. Check the list:   ./sync-secrets.ps1 -VaultName $VaultName -List
  2. Point the release at the vault:
       gh variable set AZURE_KEY_VAULT_NAME -b '$VaultName'
  3. Push to main. The release compares the Secret's hash before and after, so
     a run reporting 'App secrets unchanged' is proof the vault reproduced the
     bundle byte-for-byte.
  4. Only after that green run, delete the old blob:
       gh secret delete SPARX_APP_SECRETS_ENV
"@ -ForegroundColor Cyan
