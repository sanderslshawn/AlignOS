# Test Backend Advisor Endpoint
#
# Prerequisites:
# 1. Install dependencies: cd services/api && npm install
# 2. Add OpenAI API key to .env file
# 3. Start server: npm run dev
# 4. Run these test commands

## Test 1: Health Check
Write-Host "`n=== Test 1: Health Check ===" -ForegroundColor Cyan
curl http://localhost:3000/health

## Test 2: Advisor Health
Write-Host "`n`n=== Test 2: Advisor Health ===" -ForegroundColor Cyan
curl http://localhost:3000/api/advisor/health

## Test 3: Banana Pudding Question (comfort_meal intent)
Write-Host "`n`n=== Test 3: Banana Pudding Question ===" -ForegroundColor Cyan
$body = @{
  deviceId = "test-device"
  message = "At what time should I eat the banana pudding?"
  dayContext = @{
    now = "2026-03-02T15:30:00Z"
    nowLocal = "3:30pm"
    wakeTime = "07:00"
    sleepTime = "23:00"
    bedtime = "9:30pm"
    fastingHours = 14
    dayMode = "flex"
    sleepQuality = 7
    stressLevel = 5
    lastMealTime = "12:30pm"
    lastMealType = "lean-protein"
    hoursSinceLastMeal = 3
    nextMealTime = "7:00pm"
    nextMealType = "richer-protein"
    schedulePreview = @()
  }
} | ConvertTo-Json -Depth 10

Invoke-RestMethod -Uri http://localhost:3000/api/advisor `
  -Method Post `
  -ContentType "application/json" `
  -Body $body | ConvertTo-Json -Depth 10

## Test 4: Snack Between Meals Question
Write-Host "`n`n=== Test 4: Snack Between Meals Question ===" -ForegroundColor Cyan
$body2 = @{
  deviceId = "test-device"
  message = "Can I have a snack? I ate lunch 2 hours ago"
  dayContext = @{
    now = "2026-03-02T14:30:00Z"
    nowLocal = "2:30pm"
    wakeTime = "07:00"
    sleepTime = "23:00"
    bedtime = "9:30pm"
    fastingHours = 14
    dayMode = "tight"
    sleepQuality = 8
    stressLevel = 4
    lastMealTime = "12:30pm"
    lastMealType = "lean-protein"
    hoursSinceLastMeal = 2
    nextMealTime = "6:00pm"
    nextMealType = "richer-protein"
    schedulePreview = @()
  }
} | ConvertTo-Json -Depth 10

Invoke-RestMethod -Uri http://localhost:3000/api/advisor `
  -Method Post `
  -ContentType "application/json" `
  -Body $body2 | ConvertTo-Json -Depth 10

## Test 5: Quota Limit (run 6 times)
Write-Host "`n`n=== Test 5: Testing Daily Limit (5 calls) ===" -ForegroundColor Cyan
Write-Host "Calling endpoint 6 times with same deviceId..." -ForegroundColor Yellow

$testBody = @{
  deviceId = "quota-test-device"
  message = "Should I have coffee now?"
  dayContext = @{
    now = "2026-03-02T14:00:00Z"
    nowLocal = "2:00pm"
    wakeTime = "07:00"
    sleepTime = "23:00"
  }
} | ConvertTo-Json -Depth 10

for ($i = 1; $i -le 6; $i++) {
  Write-Host "`nCall $i/6:" -ForegroundColor Yellow
  try {
    $response = Invoke-RestMethod -Uri http://localhost:3000/api/advisor `
      -Method Post `
      -ContentType "application/json" `
      -Body $testBody
    Write-Host "  Remaining: $($response.meta.llmRemaining)/$($response.meta.llmLimit)" -ForegroundColor Green
    if ($response.meta.llmRemaining -eq 0) {
      Write-Host "  Direct Answer: $($response.response.directAnswer)" -ForegroundColor Red
      break
    }
  } catch {
    Write-Host "  Error: $_" -ForegroundColor Red
  }
  Start-Sleep -Seconds 1
}

Write-Host "`n`n=== All Tests Complete ===" -ForegroundColor Green
Write-Host "Check responses for:" -ForegroundColor Cyan
Write-Host "  - Structured JSON with intent, directAnswer, nextMoves, etc." -ForegroundColor White
Write-Host "  - Meta info with llmUsedToday, llmRemaining" -ForegroundColor White
Write-Host "  - Limit exceeded message after 5 calls" -ForegroundColor White
