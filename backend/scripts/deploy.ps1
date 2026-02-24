#!/usr/bin/env pwsh

# EcEClassroom D1 Database & Worker Deployment Script (PowerShell)
# Run: .\scripts\deploy.ps1

$ErrorActionPreference = "Continue"

Write-Host "╔════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║          EcEClassroom D1 Database Setup & Deploy               ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Check prerequisites
Write-Host "[1/5] Checking prerequisites..." -ForegroundColor Blue
Write-Host ""

try {
    $wranglerVersion = wrangler --version 2>&1
    Write-Host "✓ Wrangler CLI found: $wranglerVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ Wrangler not found" -ForegroundColor Red
    Write-Host "Install with: npm install -g @cloudflare/wrangler"
    exit 1
}

try {
    $gitVersion = git --version 2>&1
    Write-Host "✓ Git found: $gitVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ Git not found" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "[2/5] Creating D1 database..." -ForegroundColor Blue
Write-Host ""

# Create D1 database
$dbOutput = wrangler d1 create eclassroom --yes 2>&1
Write-Host $dbOutput

# Extract database ID
$dbIdMatch = $dbOutput | Select-String -Pattern 'database_id: ([a-f0-9-]+)' | Select-Object -First 1
if ($dbIdMatch) {
    $dbId = $dbIdMatch.Matches.Groups[1].Value
} else {
    Write-Host "⚠ Could not auto-detect database ID" -ForegroundColor Yellow
    $dbId = Read-Host "Enter your database ID"
}

if ([string]::IsNullOrEmpty($dbId)) {
    Write-Host "✗ Database ID required to continue" -ForegroundColor Red
    exit 1
}

Write-Host "✓ Database ID: $dbId" -ForegroundColor Green
Write-Host ""

# Update wrangler.toml
Write-Host "[3/5] Updating wrangler.toml..." -ForegroundColor Blue
$tomlPath = ".\wrangler.toml"

if (Test-Path $tomlPath) {
    $content = Get-Content $tomlPath -Raw
    if ($content -match 'database_id = "YOUR_DB_ID"') {
        $content = $content -replace 'database_id = "YOUR_DB_ID"', "database_id = ""$dbId"""
        Set-Content $tomlPath $content -Encoding UTF8
        Write-Host "✓ wrangler.toml updated" -ForegroundColor Green
    } else {
        Write-Host "⚠ Could not find YOUR_DB_ID placeholder in wrangler.toml" -ForegroundColor Yellow
        Write-Host "Please manually update with: database_id = ""$dbId""" -ForegroundColor Yellow
    }
} else {
    Write-Host "✗ wrangler.toml not found" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "[4/5] Running database migrations..." -ForegroundColor Blue
Write-Host ""

$migrationFile = ".\migrations\0001_init.sql"
if (Test-Path $migrationFile) {
    Write-Host "Running migration: $migrationFile" -ForegroundColor Gray
    $migrationOutput = wrangler d1 execute eclassroom --file $migrationFile --remote 2>&1
    Write-Host $migrationOutput
    Write-Host "✓ Migration completed" -ForegroundColor Green
} else {
    Write-Host "✗ Migration file not found: $migrationFile" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "[5/5] Deploying Worker..." -ForegroundColor Blue
Write-Host ""

$deployOutput = wrangler deploy 2>&1
Write-Host $deployOutput

if ($LASTEXITCODE -eq 0) {
    $workerUrl = "https://ec-eclassroom-backend.espaderarios.workers.dev"
    Write-Host ""
    Write-Host "✓ Worker deployed successfully" -ForegroundColor Green
    Write-Host ""
    Write-Host "════════════════════════════════════════════════════════════════" -ForegroundColor Green
    Write-Host ""
    Write-Host "📍 Deployment Summary:" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  Worker URL:  $workerUrl" -ForegroundColor Green
    Write-Host "  Database ID: $dbId" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  1. Test the health endpoint:" -ForegroundColor Gray
    Write-Host "     curl $workerUrl/health" -ForegroundColor White
    Write-Host ""
    Write-Host "  2. Verify database connectivity:" -ForegroundColor Gray
    Write-Host "     curl -X GET ""$workerUrl/api/flashcards?userId=test_user""" -ForegroundColor White
    Write-Host ""
    Write-Host "  3. Check Cloudflare Dashboard:" -ForegroundColor Gray
    Write-Host "     https://dash.cloudflare.com → Workers → ec-eclassroom-backend" -ForegroundColor White
    Write-Host ""
    Write-Host "════════════════════════════════════════════════════════════════" -ForegroundColor Green
} else {
    Write-Host "✗ Deployment failed" -ForegroundColor Red
    exit 1
}
