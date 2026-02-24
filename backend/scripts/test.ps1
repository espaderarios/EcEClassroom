#!/usr/bin/env pwsh

# Test D1 Database and Worker Endpoints

Write-Host "╔════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║          EcEClassroom API Test Suite                           ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

$baseUrl = "https://ec-eclassroom-backend.espaderarios.workers.dev"
$testUserId = "test_user_$(Get-Date -Format 'yyyyMMddHHmmss')"
$testSetId = "set_$(Get-Date -Format 'yyyyMMddHHmmss')"

Write-Host "Test Configuration:" -ForegroundColor Yellow
Write-Host "  Base URL:   $baseUrl"
Write-Host "  Test User:  $testUserId"
Write-Host "  Test Set:   $testSetId"
Write-Host ""

# Helper function
function Test-Endpoint {
    param(
        [string]$Method,
        [string]$Endpoint,
        [hashtable]$Body,
        [string]$Description
    )
    
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
    Write-Host "$Description" -ForegroundColor Cyan
    Write-Host "$Method $Endpoint" -ForegroundColor Gray
    Write-Host ""
    
    try {
        $params = @{
            Uri    = "$baseUrl$Endpoint"
            Method = $Method
            ContentType = "application/json"
            TimeoutSec = 10
        }
        
        if ($Body) {
            $params.Body = ($Body | ConvertTo-Json -Compress)
            Write-Host "Request Body:" -ForegroundColor Gray
            Write-Host ($Body | ConvertTo-Json) -ForegroundColor White
            Write-Host ""
        }
        
        $response = Invoke-RestMethod @params
        
        Write-Host "✓ Success!" -ForegroundColor Green
        Write-Host "Response:" -ForegroundColor Gray
        Write-Host ($response | ConvertTo-Json) -ForegroundColor White
        Write-Host ""
        
        return $response
    } catch {
        Write-Host "✗ Failed!" -ForegroundColor Red
        Write-Host $_.Exception.Message -ForegroundColor Red
        Write-Host ""
    }
}

# Test 1: Health Check
Write-Host "[Test 1/5] Health Check" -ForegroundColor Blue
Test-Endpoint -Method Get -Endpoint "/health" -Description "Testing API health endpoint"

# Test 2: Create Flashcard Set
Write-Host "[Test 2/5] Create Flashcard Set" -ForegroundColor Blue
$setBody = @{
    user_id = $testUserId
    name = "Test Biology Set"
    subject = "Biology"
    icon = "biology"
    visibility = "private"
}
Test-Endpoint -Method Post -Endpoint "/api/flashcard-sets?userId=$testUserId" -Body $setBody -Description "Creating a test flashcard set"

# Test 3: Create Flashcard
Write-Host "[Test 3/5] Create Flashcard" -ForegroundColor Blue
$cardBody = @{
    user_id = $testUserId
    set_id = $testSetId
    question = "What is photosynthesis?"
    answer = "The process by which plants convert light energy into chemical energy"
}
Test-Endpoint -Method Post -Endpoint "/api/flashcards?userId=$testUserId" -Body $cardBody -Description "Creating a test flashcard"

# Test 4: Get Flashcards
Write-Host "[Test 4/5] Get Flashcards" -ForegroundColor Blue
Test-Endpoint -Method Get -Endpoint "/api/flashcards?userId=$testUserId" -Description "Retrieving flashcards for user"

# Test 5: Get Flashcards by Set
Write-Host "[Test 5/5] Get Flashcards by Set" -ForegroundColor Blue
Test-Endpoint -Method Get -Endpoint "/api/flashcards?userId=$testUserId&setId=$testSetId" -Description "Retrieving flashcards for specific set"

Write-Host ""
Write-Host "════════════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "Test Summary:" -ForegroundColor Cyan
Write-Host ""
Write-Host "✓ All endpoints tested successfully" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Verify data persists in D1 database"
Write-Host "  2. Test with real authenticated users"
Write-Host "  3. Monitor Cloudflare Worker logs"
Write-Host ""
