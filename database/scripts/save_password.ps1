<#
.SYNOPSIS
    Store the Supabase database password in psql's credential file.

.DESCRIPTION
    Writes an entry to %APPDATA%\postgresql\pgpass.conf so psql can connect
    without a password on the command line. The password is typed into a masked
    prompt, so it never appears on screen, in shell history, in the process list,
    or in any file in this project.

    Run this once, then deploy with:
        .\database\scripts\deploy.ps1 -ConnectionString $env:KX_DB_URL

.EXAMPLE
    .\database\scripts\save_password.ps1
#>
param(
    [string]$DbHost = 'aws-1-eu-west-1.pooler.supabase.com',
    [int]$Port      = 5432,
    [string]$Database = 'postgres',
    [string]$User   = 'postgres.fqxiskkyvbkhrpejxtol'
)

$ErrorActionPreference = 'Stop'

Write-Host "Storing the database password for:" -ForegroundColor Cyan
Write-Host "  $User@${DbHost}:$Port/$Database"
Write-Host ""
Write-Host "This is the DATABASE password (Supabase -> Settings -> Database)," -ForegroundColor DarkGray
Write-Host "not an API key. Nothing is echoed as you type." -ForegroundColor DarkGray
Write-Host ""

$secure = Read-Host -Prompt "Password" -AsSecureString
$plain  = [Runtime.InteropServices.Marshal]::PtrToStringBSTR(
              [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))

if ([string]::IsNullOrWhiteSpace($plain)) { throw "no password entered" }

$dir  = Join-Path $env:APPDATA 'postgresql'
$file = Join-Path $dir 'pgpass.conf'
if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null }

# pgpass format: hostname:port:database:username:password
# a colon or backslash inside any field has to be escaped with a backslash
$esc = { param($s) $s -replace '\\', '\\\\' -replace ':', '\:' }
$line = "{0}:{1}:{2}:{3}:{4}" -f (& $esc $DbHost), $Port, (& $esc $Database),
                                 (& $esc $User), (& $esc $plain)

$prefix = "{0}:{1}:{2}:{3}:" -f (& $esc $DbHost), $Port, (& $esc $Database), (& $esc $User)
$existing = if (Test-Path $file) {
    @(Get-Content $file | Where-Object { $_ -notlike "$prefix*" -and $_.Trim() -ne '' })
} else { @() }

Set-Content -Path $file -Value ($existing + $line) -Encoding ascii
$plain = $null
[GC]::Collect()

# readable only by this account
icacls $file /inheritance:r /grant:r "$($env:USERNAME):(R,W)" | Out-Null

Write-Host ""
Write-Host "Saved to $file" -ForegroundColor Green
Write-Host "psql will now authenticate on its own. Verifying..." -ForegroundColor Cyan

$psql = (Get-Command psql -ErrorAction SilentlyContinue).Source
if (-not $psql) {
    $psql = Get-ChildItem 'C:\Program Files\PostgreSQL\*\bin\psql.exe' -ErrorAction SilentlyContinue |
            Sort-Object FullName -Descending | Select-Object -First 1 -ExpandProperty FullName
}

$uri = "postgresql://$User@${DbHost}:$Port/$Database`?sslmode=require"
$env:KX_DB_URL = $uri
[Environment]::SetEnvironmentVariable('KX_DB_URL', $uri, 'User')

& $psql $uri -t -c "select 'connected to ' || current_database() || ' as ' || current_user;"
if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "Connection works. KX_DB_URL is set for future terminals." -ForegroundColor Green
    Write-Host "Tell Claude it is done, or run:" -ForegroundColor Green
    Write-Host "  .\database\scripts\deploy.ps1 -ConnectionString `"$uri`""
} else {
    Write-Host ""
    Write-Host "Could not connect. Most likely the password is wrong -- you can reset it" -ForegroundColor Red
    Write-Host "at Supabase -> Project Settings -> Database -> Reset database password," -ForegroundColor Red
    Write-Host "then run this script again." -ForegroundColor Red
}
