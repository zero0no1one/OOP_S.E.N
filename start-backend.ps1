param(
    [string]$DbHost = 'db.hzvnooeutdtncuvuajvk.supabase.co',
    [int]$DbPort = 5432,
    [string]$DbUser = 'studyspot_api',
    [string]$CertificatePath = (Join-Path $PSScriptRoot 'backend/supabase-ca.crt'),
    [string]$JarPath = (Join-Path $PSScriptRoot 'backend/target/studyspot-api-1.0.0.jar'),
    [switch]$LocalNetwork,
    [int]$Port = 8080
)

$ErrorActionPreference = 'Stop'
if (!(Test-Path -LiteralPath $JarPath)) { throw 'Run mvn package inside the backend folder first.' }
if ($DbHost -notmatch '^[a-zA-Z0-9.-]+$' -or $DbPort -lt 1 -or $DbPort -gt 65535) { throw 'Enter a valid database hostname and port.' }
$certificate = [Uri]::EscapeDataString((Resolve-Path -LiteralPath $CertificatePath).Path)
$previousUrl = $env:DB_JDBC_URL
$previousUser = $env:DB_USER
$previousPassword = $env:DB_PASSWORD
$secret = $null
try {
    if (!$env:DB_PASSWORD) {
        $secret = Read-Host 'Database password (not saved)' -AsSecureString
        $env:DB_PASSWORD = [System.Net.NetworkCredential]::new('', $secret).Password
    }
    $env:DB_JDBC_URL = "jdbc:postgresql://${DbHost}:${DbPort}/postgres?sslmode=verify-full&sslrootcert=$certificate"
    $env:DB_USER = $DbUser
    $bindAddress = if ($LocalNetwork) { '0.0.0.0' } else { '127.0.0.1' }
    & java -jar (Resolve-Path -LiteralPath $JarPath).Path "--server.address=$bindAddress" "--server.port=$Port"
    if ($LASTEXITCODE) { throw "Java exited with code $LASTEXITCODE." }
} finally {
    $env:DB_JDBC_URL = $previousUrl
    $env:DB_USER = $previousUser
    $env:DB_PASSWORD = $previousPassword
    if ($secret) { $secret.Dispose() }
}
