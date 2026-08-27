<#
.SYNOPSIS
    Deploy the KarinationGroup database to Supabase with psql.

.DESCRIPTION
    Runs every SQL file in order against the connection string you pass.
    Must be run from the project folder, because 02_load_from_csv.sql
    reads database/csv/*.csv by relative path.

.EXAMPLE
    .\database\scripts\deploy.ps1 -ConnectionString "postgresql://postgres.abcdefgh:PASSWORD@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres"

.EXAMPLE
    # skip the optional real-world airport data
    .\database\scripts\deploy.ps1 -ConnectionString $env:SUPABASE_DB_URL -SkipAirportBackfill
#>
param(
    [Parameter(Mandatory = $true)]
    [string]$ConnectionString,

    [switch]$SkipAirportBackfill,

    # seed this many days of departures for the demand simulation; 0 skips it
    [int]$SeedDays = 14
)

$ErrorActionPreference = 'Stop'

# The EDB installer does not put psql on PATH, and a terminal opened before the
# install keeps the old PATH regardless. Fall back to the standard locations.
$psql = (Get-Command psql -ErrorAction SilentlyContinue).Source
if (-not $psql) {
    $psql = Get-ChildItem 'C:\Program Files\PostgreSQL\*\bin\psql.exe',
                          'C:\Program Files (x86)\PostgreSQL\*\bin\psql.exe' `
            -ErrorAction SilentlyContinue |
            Sort-Object FullName -Descending |
            Select-Object -First 1 -ExpandProperty FullName
}
if (-not $psql) {
    Write-Host "psql was not found." -ForegroundColor Red
    Write-Host "Install it with:  winget install PostgreSQL.PostgreSQL.17" -ForegroundColor Yellow
    Write-Host "Or load without psql:  python database/scripts/load_to_supabase.py" -ForegroundColor Yellow
    exit 1
}
Write-Host "psql: $psql"

$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $root
Write-Host "project: $root"

# Pre-flight. Supabase's direct host (db.<ref>.supabase.co) publishes only an
# AAAA record, so it is unreachable from an IPv4-only network -- psql reports it
# as "could not translate host name". Catch that here rather than mid-load.
if ($ConnectionString -match '@([^:/?]+)') {
    $dbHost = $Matches[1]
    $hasA = $null -ne (Resolve-DnsName $dbHost -Type A -ErrorAction SilentlyContinue |
                       Where-Object { $_.Type -eq 'A' })
    if (-not $hasA) {
        $hasAAAA = $null -ne (Resolve-DnsName $dbHost -Type AAAA -ErrorAction SilentlyContinue |
                              Where-Object { $_.Type -eq 'AAAA' })
        $localV6 = Get-NetIPAddress -AddressFamily IPv6 -ErrorAction SilentlyContinue |
                   Where-Object { $_.PrefixOrigin -ne 'WellKnown' -and
                                  $_.IPAddress -notlike 'fe80*' -and $_.IPAddress -ne '::1' }
        if ($hasAAAA -and -not $localV6) {
            Write-Host ""
            Write-Host "$dbHost resolves over IPv6 only, and this machine has no IPv6 route." -ForegroundColor Red
            Write-Host "Supabase direct connections are IPv6-only without the IPv4 add-on." -ForegroundColor Yellow
            Write-Host "Use the SESSION POOLER string instead -- Dashboard -> Connect -> Session pooler:" -ForegroundColor Yellow
            Write-Host "  postgresql://postgres.<ref>:<password>@aws-1-<region>.pooler.supabase.com:5432/postgres" -ForegroundColor Yellow
            Write-Host "(port 5432, not the 6543 transaction pooler -- \copy needs a real session.)" -ForegroundColor DarkGray
            exit 1
        }
        if (-not $hasAAAA) {
            Write-Host "warning: $dbHost does not resolve at all -- check the host name." -ForegroundColor Yellow
        }
    }
}

$files = @(
    '01_schema.sql',
    '02_load_from_csv.sql',
    '03_airports_backfill.sql',
    '04_views.sql',
    '05_reservations.sql',
    '06_demand_simulation.sql',
    '07_rls_policies.sql'
)

foreach ($file in $files) {
    $path = Join-Path 'database/sql' $file

    if ($file -eq '03_airports_backfill.sql') {
        if ($SkipAirportBackfill) { Write-Host "-- $file skipped (-SkipAirportBackfill)"; continue }
        if (-not (Test-Path $path)) { Write-Host "-- $file not generated yet, skipped" -ForegroundColor DarkGray; continue }
    }

    if (-not (Test-Path $path)) { throw "missing $path" }

    Write-Host ">> $file" -ForegroundColor Cyan
    & $psql $ConnectionString --set ON_ERROR_STOP=1 --quiet -f $path
    if ($LASTEXITCODE -ne 0) { throw "$file failed with exit code $LASTEXITCODE" }
}

if ($SeedDays -gt 0) {
    Write-Host ">> seeding $SeedDays days of departures" -ForegroundColor Cyan
    & $psql $ConnectionString --set ON_ERROR_STOP=1 --quiet `
        -c "select public.seed_departure_inventory($SeedDays) as rows_seeded;"
    if ($LASTEXITCODE -ne 0) { throw "seeding failed" }
}

Write-Host ""
Write-Host "Done. Try it:" -ForegroundColor Green
Write-Host "  psql `$env:SUPABASE_DB_URL -c `"select * from public.search_flights('SGN','KGD',current_date+7,'ECONOMY',2);`""
Write-Host "  psql `$env:SUPABASE_DB_URL -c `"select * from public.simulate_bookings();`""
Write-Host "  psql `$env:SUPABASE_DB_URL -c `"select * from public.v_management_dashboard limit 10;`""
