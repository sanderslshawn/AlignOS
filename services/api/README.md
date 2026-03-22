# AlignOS Backend API

Backend API for AlignOS physiology engine with hybrid advisor system.

## Features

- **Day State Management**: Sync day state and computed plans across devices
- **Hybrid Advisor**: AI-powered custom questions (5/day limit) via OpenAI
  - Preset answers: Handled by mobile app (27 presets, instant)
  - Custom questions: Backend LLM with strict JSON validation
  - Daily quota tracking with file-based persistence
  - Rate limiting and error handling

## Setup

### 1. Install Dependencies

```bash
cd services/api
npm install
```

### 2. Configure Environment

Create `.env` file (already created from template):

```bash
# Verify .env exists
cat .env

# Add your OpenAI API key
# Get key from: https://platform.openai.com/api-keys
```

Edit `.env` and replace `sk-your-key-here` with your actual OpenAI API key:

```env
OPENAI_API_KEY=sk-proj-...your-key...
```

### 3. Start Server

```bash
npm run dev
```

Server will start on http://localhost:3000

## API Endpoints

### Health Check

```bash
GET /health
```

Response:
```json
{
  "status": "ok",
  "timestamp": "2026-03-02T15:30:00.000Z"
}
```

### Advisor Health

```bash
GET /api/advisor/health
```

Response:
```json
{
  "status": "ok",
  "timestamp": "2026-03-02T15:30:00.000Z",
  "hasApiKey": true
}
```

### Ask Advisor

```bash
POST /api/advisor
Content-Type: application/json
```

Request body:
```json
{
  "deviceId": "test-device",
  "message": "At what time should I eat the banana pudding?",
  "dayContext": {
    "now": "2026-03-02T15:30:00Z",
    "nowLocal": "3:30pm",
    "wakeTime": "07:00",
    "sleepTime": "23:00",
    "bedtime": "9:30pm",
    "fastingHours": 14,
    "dayMode": "flex",
    "sleepQuality": 7,
    "stressLevel": 5,
    "lastMealTime": "12:30pm",
    "lastMealType": "lean-protein",
    "hoursSinceLastMeal": 3,
    "nextMealTime": "7:00pm",
    "nextMealType": "richer-protein",
    "schedulePreview": []
  }
}
```

Response:
```json
{
  "response": {
    "source": "llm",
    "intent": "comfort_meal",
    "directAnswer": "Optimal window: 7:15-8:15pm (2-3h after dinner, 2h+ before bed). Always protein-first meal, then 15min walk after.",
    "nextMoves": [
      { "time": "7:00pm", "title": "Protein dinner", "reason": "Base meal before treat" },
      { "time": "8:00pm", "title": "Banana pudding", "reason": "Peak treat window" },
      { "time": "8:15pm", "title": "15min walk", "reason": "Glucose disposal" }
    ],
    "ifThen": [
      { "if": "If still hungry after walk", "then": "Wait 30min, reassess. Walk blunts cravings." }
    ],
    "why": "Treats work best 2-3h post-protein when insulin sensitivity is primed. Walk after prevents glucose spike.",
    "inserts": [
      { "time": "8:00pm", "type": "comfort-meal", "note": "Banana pudding (treat window)" }
    ],
    "actions": [
      { "id": "add-to-schedule", "label": "Add to schedule" },
      { "id": "set-reminder", "label": "Set reminder", "payload": { "time": "8:00pm" } }
    ]
  },
  "meta": {
    "llmUsedToday": 1,
    "llmLimit": 5,
    "llmRemaining": 4,
    "source": "llm",
    "processingTimeMs": 1250,
    "tokensUsed": 425
  }
}
```

### Day Endpoints

- `GET /day/:deviceId/today` - Get today's plan
- `POST /day/:deviceId/state` - Update day state
- `POST /day/:deviceId/events` - Add event to schedule
- `POST /day/:deviceId/recompute` - Recompute plan from input
- `GET /day/:deviceId/export/today` - Export day as JSON

## Testing

### Test Advisor Endpoint

```bash
# Test custom question
curl -X POST http://localhost:3000/api/advisor \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "test-device",
    "message": "At what time should I eat the banana pudding?",
    "dayContext": {
      "now": "2026-03-02T15:30:00Z",
      "nowLocal": "3:30pm",
      "wakeTime": "07:00",
      "sleepTime": "23:00",
      "bedtime": "9:30pm",
      "fastingHours": 14,
      "dayMode": "flex",
      "sleepQuality": 7,
      "stressLevel": 5,
      "lastMealTime": "12:30pm",
      "lastMealType": "lean-protein",
      "hoursSinceLastMeal": 3,
      "nextMealTime": "7:00pm",
      "nextMealType": "richer-protein",
      "schedulePreview": []
    }
  }'

# Expected: comfort_meal intent, time window, actions
```

### Test Daily Limit

Call the endpoint 6 times with the same deviceId:

```bash
# Calls 1-5: Normal responses
# Call 6: Limit exceeded message
```

Expected 6th response:
```json
{
  "response": {
    "source": "llm",
    "intent": "unknown",
    "directAnswer": "Daily custom question limit reached (5/5 used). Resets at midnight. Try preset questions.",
    ...
  },
  "meta": {
    "llmUsedToday": 5,
    "llmLimit": 5,
    "llmRemaining": 0,
    ...
  }
}
```

## Architecture

### Advisor Flow

```
Mobile App
  ↓
  1. Check preset match (≥0.72 score)
     → Instant answer from mobile
  ↓
  2. If <0.72, check daily limit
     → If exceeded, show preset suggestions
  ↓
  3. POST /api/advisor
     → Backend checks quota
     → Calls OpenAI with system prompt
     → Validates with Zod schema
     → Increments usage counter
     → Returns structured response
```

### Backend Components

- **advisorSchema.ts**: Zod schemas for validation
- **advisorPrompt.ts**: System prompt with AlignOS voice + rules
- **llmClient.ts**: OpenAI API wrapper
- **usageStore.ts**: File-based daily limit tracking
- **advisorService.ts**: Orchestration layer
- **advisorRoutes.ts**: Express endpoints
- **index.ts**: Server entry point

### Data Storage

```
services/api/data/
  advisor-usage.json     # Daily usage: {deviceId_YYYY-MM-DD: count}
  {deviceId}.json        # Day state for each device
```

Usage data auto-cleans entries older than 7 days.

## Configuration

Environment variables in `.env`:

```env
# Server
PORT=3000

# OpenAI
OPENAI_API_KEY=sk-proj-...
ADVISOR_MODEL=gpt-4o-mini
ADVISOR_MAX_TOKENS=600
ADVISOR_DAILY_LIMIT=5

# Rate Limiting
ADVISOR_RATE_LIMIT_WINDOW_MS=900000      # 15 minutes
ADVISOR_RATE_LIMIT_MAX_REQUESTS=20       # Max per window
```

## Troubleshooting

### "LLM not configured" error

Check:
1. `.env` file exists in `services/api/`
2. `OPENAI_API_KEY` is set to valid key (starts with `sk-`)
3. Server restarted after changing `.env`

### "Daily limit reached" before 5 calls

Check `services/api/data/advisor-usage.json`:
```json
{
  "test-device_2026-03-02": 5
}
```

Reset manually or wait for next day (auto-cleanup).

### Validation errors

Check that `dayContext` includes all required fields:
- now (ISO 8601 string)
- nowLocal (string)
- wakeTime (HH:MM)
- sleepTime (HH:MM)

Optional fields: bedtime, fastingHours, dayMode, sleepQuality, stressLevel, lastMealTime, lastMealType, hoursSinceLastMeal, nextMealTime, nextMealType, schedulePreview

## Development

```bash
# Start in watch mode
npm run dev

# Build TypeScript
npm run build

# Start production
npm start
```

## Mobile Integration

Mobile app at `apps/mobile/src/advisor/` already configured to:
1. Try preset match first (27 presets)
2. Fall back to backend API if no match
3. Track quota from response meta
4. Show "X/5 remaining" in UI

Set in mobile `.env`:
```env
EXPO_PUBLIC_API_URL=http://localhost:3000
```
