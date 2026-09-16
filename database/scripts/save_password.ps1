<#
.SYNOPSIS
    Store the Karination database password in this project's OWN credential file.

.DESCRIPTION
    The password is typed into a masked prompt, so it never appears on screen,
    in shell history, in the process list, or anywhere in this repository.

    Why a file of its own. psql's default credential file,
    %APPDATA%\postgresql\pgpass.conf, is shared by every project on this
    machine. Karination and another Supabase project were both keeping their
    password there, and each time one of them saved, the other's entry was
    lost. psql then found no password and silently fell back to prompting for
    one -- which from the outside looked exactly like a database that would
    not answer.

    So this project's password lives in:
        %APPDATA%\karination\pgpass.conf
    and the connection string saved to KX_DB_URL names that file with libpq's
    `passfile` setting. Anything that connects with KX_DB_URL reads this file
    and only this file. The shared default file is never read or written here,
    so other projects' passwords are left exactly as they are.

    Run this once, then deploy with:
        .\database\scripts\deploy.ps1 -ConnectionString $env:KX_DB_URL

.EXAMPLE
    .\database\scripts\save_password.ps1
#>
param(
    [string]$DbHost   = 'aws-1-eu-west-1.pooler.supabase.com',
    [int]$Port        = 5432,
    [string]$Database = 'postgres',
    [string]$User     = 'postgres.fqxiskkyvbkhrpejxtol',
    [string]$PassFile = (Join-Path $env:APPDATA 'karination\pgpass.conf')
)

$ErrorActionPreference = 'Stop'

Write-Host "Storing the Karination database password for:" -ForegroundColor Cyan
Write-Host "  $User@${DbHost}:$Port/$Database"
Write-Host "  in $PassFile  (this project only)"
Write-Host ""
Write-Host "This is the DATABASE password (Supabase -> Project Settings -> Database)," -ForegroundColor DarkGray
Write-Host "not an API key. Nothing is echoed as you type. You will only be asked once." -ForegroundColor DarkGray
Write-Host ""

$secure = Read-Host -Prompt "Database password" -AsSecureString
$bstr   = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try     { $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) }
finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }

if ([string]::IsNullOrWhiteSpace($plain)) { throw "no password entered" }

# pgpass format: hostname:port:database:username:password
# A backslash or colon inside a field is escaped with a backslash. In a .NET
# regex REPLACEMENT a backslash is literal, so '\\' inserts exactly two -- the
# previous version wrote '\\\\' and inserted four, corrupting any password
# that contained a backslash.
$esc = { param($s) ($s -replace '\\', '\\') -replace ':', '\:' }
$prefix = "{0}:{1}:{2}:{3}:" -f (& $esc $DbHost), $Port, (& $esc $Database), (& $esc $User)
$line   = $prefix + (& $esc $plain)

$dir = Split-Path -Parent $PassFile
if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null }

# Replace this user's line, keep any other line in this project's file.
$lines = @()
if (Test-Path $PassFile) {
    $lines = @(Get-Content $PassFile | Where-Object {
        -not $_.StartsWith($prefix) -and $_.Trim() -ne ''
    })
}
$lines += $line

# UTF-8 WITHOUT a byte-order mark. Set-Content -Encoding ascii turned any
# non-ASCII character in a password into '?', and Windows PowerShell's UTF8
# option adds a BOM that breaks libpq's match on the first line.
[IO.File]::WriteAllLines($PassFile, [string[]]$lines, (New-Object Text.UTF8Encoding $false))
$plain = $null; $line = $null; $lines = $null
[GC]::Collect()

# No icacls here. %APPDATA% is already private to this account; the previous
# version tightened the ACL and discarded icacls' output, so a partial failure
# could lock the account out of its own file without saying so.

Write-Host ""
Write-Host "Saved to $PassFile" -ForegroundColor Green

# The connection string names the file, so no global PGPASSFILE is needed --
# setting one would redirect every other project's psql here too.
$fileParam = [uri]::EscapeDataString(($PassFile -replace '\\', '/'))
$uri = "postgresql://$User@${DbHost}:$Port/$Database`?sslmode=require&passfile=$fileParam"

$psql = (Get-Command psql -ErrorAction SilentlyContinue).Source
if (-not $psql) {
    $psql = Get-ChildItem 'C:\Program Files\PostgreSQL\*\bin\psql.exe' -ErrorAction SilentlyContinue |
            Sort-Object FullName -Descending | Select-Object -First 1 -ExpandProperty FullName
}

Write-Host "Verifying..." -ForegroundColor Cyan
# -w: never prompt. If the saved password is wrong or unreadable this fails
# with a message instead of asking for a password a second time.
#
# psql reports failure on stderr. Under Windows PowerShell 5.1 with
# ErrorActionPreference 'Stop', capturing that stream turns psql's own message
# into a terminating NativeCommandError and a stack trace, so the preference is
# relaxed for this one call and the exit code is read instead.
$ErrorActionPreference = 'Continue'
$out  = (& $psql -w $uri -tAc "select 'connected to ' || current_database() || ' as ' || current_user;" 2>&1 |
         ForEach-Object { "$_" }) -join ' '
$code = $LASTEXITCODE
$ErrorActionPreference = 'Stop'

if ($code -eq 0) {
    # Only now, with a password that demonstrably works, is the environment
    # changed. A mistyped password leaves KX_DB_URL exactly as it was.
    $env:KX_DB_URL = $uri
    [Environment]::SetEnvironmentVariable('KX_DB_URL', $uri, 'User')
    Write-Host "  $out"
    Write-Host ""
    Write-Host "Connection works. KX_DB_URL is set for future terminals." -ForegroundColor Green
    Write-Host "Tell Claude it is done."
} else {
    Write-Host "  $out" -ForegroundColor Red
    Write-Host ""
    Write-Host "Could not connect with that password. If you are not sure of it, reset it at" -ForegroundColor Red
    Write-Host "Supabase -> Project Settings -> Database -> Reset database password" -ForegroundColor Red
    Write-Host "(this does not affect the website, which uses the API key), then run this again." -ForegroundColor Red
    exit 1
}
