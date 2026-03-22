# AlignOS Hybrid AI Advisor

A cost-optimized advisor system combining preset templates with LLM fallback.

## Architecture

### Design Goals
- **95%+ coverage via presets**: Reduce LLM API costs dramatically
- **Instant responses**: No network latency for common questions
- **Metered custom questions**: 5 per user per day
- **Unified response format**: Single schema regardless of source

### Flow Diagram
```
User Question
    ↓
Build Day Context (profile, dayState, schedule)
    ↓
Match Against Preset Bank
    ↓
    ├─ Score ≥ 0.72 → PRESET PATH
    │   └─ Render template with context → Return response
    │
    ├─ Score 0.45-0.72 → CLARIFY PATH
    │   └─ Show top 3 suggestions → User picks or rephrases
    │
    └─ Score < 0.45 → LLM PATH
        ├─ Check daily limit (5/day)
        │   ├─ Limit exceeded → Return limit error
        │   └─ Has quota → Continue
        └─ Call LLM (backend or OpenAI) → Return response
```

## File Structure

```
apps/mobile/src/advisor/
├── index.ts                    # Main exports
├── router.ts                   # Main entry point (ask function)
│
├── types/
│   └── advisorResponse.ts      # Zod schemas + TypeScript types
│
├── presets/
│   ├── presetBank.json         # 27+ templated Q&A pairs
│   ├── matchPreset.ts          # Scoring algorithm
│   └── renderTemplate.ts       # Variable substitution engine
│
├── context/
│   └── buildDayContext.ts      # Extract 18 fields from stores
│
├── limits/
│   └── dailyLimit.ts           # AsyncStorage tracking (5/day)
│
├── llm/
│   ├── systemPrompt.ts         # AlignOS voice + constraints
│   └── askLLM.ts               # Backend API or OpenAI direct
│
└── utils/
    └── time.ts                 # Helper functions (hoursSince, formatTime, etc)
```

## Usage

### Basic Usage
```typescript
import { ask } from '../advisor';

const response = await ask("When should I eat lunch?");

// Response structure (unified for all sources)
{
  source: "preset" | "clarify" | "llm",
  intent: "meal_timing",
  directAnswer: "Eat lunch 4-6 hours after breakfast, around 12:30pm...",
  nextMoves: [
    { time: "12:15pm", title: "Prep meal", reason: "15min before" },
    { time: "12:30pm", title: "Eat lunch", reason: "25-35min" },
    { time: "1:00pm", title: "Post-meal movement", reason: "10-20min" }
  ],
  ifThen: [
    { if: "If meeting conflict", then: "Shift ±30min max" }
  ],
  why: "Digestive enzymes peak midday...",
  actions: [{ id: "ADD_LUNCH", label: "Add to Plan" }],
  inserts?: [{ type: "meal", title: "Lunch", startTime: "12:30pm", ... }]
}
```

### Display Daily Limit
```typescript
import { getRemainingCustomQuestions } from '../advisor';

const remaining = await getRemainingCustomQuestions(); // 0-5
// Show: "Custom questions today: {remaining}/5 remaining"
```

### Handle Clarify Responses
```typescript
if (response.source === 'clarify') {
  // Show nextMoves as tappable suggestions
  response.nextMoves.map(move => (
    <TouchableOpacity onPress={() => ask(move.title)}>
      <Text>{move.title}</Text>
    </TouchableOpacity>
  ));
}
```

## Response Schema

### AdvisorResponse
```typescript
{
  source: "preset" | "clarify" | "llm"
  intent: Intent  // 11 types (meal_timing, snack, comfort_meal, etc)
  directAnswer: string  // Max 220 chars
  nextMoves: [3 items]  // Exactly 3, with optional time + reason
  ifThen: [0-2 items]   // Max 2 conditional branches
  why: string           // 1-2 sentence physiological explanation
  actions?: Action[]    // Action buttons (ADD_TO_PLAN, INSERT_WALK, etc)
  inserts?: Insert[]    // Schedule additions (optional)
}
```

### DayContext (18 fields)
```typescript
{
  now, nowLocal, wakeTime, sleepTime, bedtime,
  fastingHours, dayMode, sleepQuality, stressLevel,
  lastMealTime, lastMealType, hoursSinceLastMeal,
  nextMealTime, nextMealType, nextWalkTime, nextWorkoutTime,
  schedulePreview: [{ time, title }]
}
```

## Preset Bank

### Example Preset
```json
{
  "id": "snack-between-meals",
  "title": "Can I snack between meals?",
  "tags": ["snack", "hunger", "meals"],
  "utterances": [
    "can i snack between meals",
    "snack between meals",
    "hungry between meals"
  ],
  "intent": "snack",
  "answerTemplate": "On {dayMode} mode: {snackRule}. Last meal was {hoursSinceLastMeal}h ago.",
  "nextMovesTemplate": [
    { "title": "Assess: stomach emptiness or mouth boredom?", "reason": "True hunger vs habit" },
    { "title": "If true hunger: 20g protein snack only", "reason": "Minimize insulin spike" },
    { "title": "Return to schedule", "reason": "No grazing pattern" }
  ],
  "ifThenTemplate": [
    { "if": "If within 2h of next meal", "then": "Wait — snacking now ruins meal appetite" }
  ],
  "whyTemplate": "Frequent eating keeps insulin elevated...",
  "actionsTemplate": []
}
```

### Template Variables
- `{now}`, `{nowLocal}` - Current time
- `{wakeTime}`, `{sleepTime}`, `{bedtime}` - Sleep schedule
- `{fastingHours}`, `{dayMode}` - User settings
- `{sleepQuality}`, `{stressLevel}` - Current state
- `{lastMealTime}`, `{hoursSinceLastMeal}` - Meal timing
- `{nextMealTime}`, `{nextWalkTime}`, `{nextWorkoutTime}` - Schedule
- Plus 20+ computed variables (optimalBreakfastTime, caffeineCutoff, etc)

## Preset Matching Algorithm

### Scoring
```typescript
score = 
  + 1.0 if exact utterance match
  + 0.8 if substring match in utterances
  + 0.6 * keyword_overlap_utterances
  + 0.4 * keyword_overlap_tags
  + 0.5 * keyword_overlap_title
  + 0.3 * synonym_matches
```

### Routing Thresholds
- **≥ 0.72**: Use preset (instant response)
- **0.45-0.72**: Clarify (show top 3 suggestions)
- **< 0.45**: LLM (if quota available)

### Synonym Map
```typescript
treat → dessert, candy, pudding, ice cream, chocolate
tired → sleepy, exhausted, fatigued, sluggish, crash
snack → nibble, bite, munch, mini meal
workout → exercise, train, gym, lift, weights
// ... 50+ synonym mappings
```

## LLM Integration

### System Prompt Constraints
- **Voice**: Direct, specific, timing-focused
- **Prohibit**: Macros, calories, generic advice, "it depends"
- **Require**: Specific times (not vague), exactly 3 nextMoves, max 2 ifThen
- **Format**: JSON only, no markdown, validated with Zod

### Fallback Chain
1. **Backend API preferred** (`POST /api/advisor`)
   - Includes context + question
   - Server-side OpenAI call
   - Rate limiting at API level
2. **Direct OpenAI** (if `EXPO_PUBLIC_OPENAI_API_KEY` exists)
   - gpt-4o-mini model
   - JSON mode enabled
   - Zod validation
3. **Error response** (if both unavailable)
   - Suggests preset categories
   - Encourages rephrasing

## Daily Limits

### Storage
```typescript
// AsyncStorage key format
advisor_custom_count_2026-02-24

// Value: integer 0-5
// Resets daily at midnight (keyed by date)
```

### Functions
```typescript
getRemainingCustomQuestions(): Promise<number>  // 0-5
incrementCustomUsed(): Promise<void>
canAskCustomQuestion(): Promise<boolean>
resetDailyLimit(): Promise<void>  // Manual reset (testing)
cleanupOldLimits(): Promise<void>  // Remove keys >7 days old
```

## Testing

### Test Preset Matching
```typescript
import { matchPreset, getRoutingDecision } from '../advisor';

const { bestMatch, score, top3 } = matchPreset("banana pudding");
// Should route to comfort_meal preset
console.log(getRoutingDecision(score)); // "preset"
```

### Test Daily Limits
```typescript
import { resetDailyLimit, getRemainingCustomQuestions } from '../advisor';

await resetDailyLimit(); // Reset to 5
const before = await getRemainingCustomQuestions(); // 5

// Ask 6 questions
for (let i = 0; i < 6; i++) {
  await ask("unique custom question " + i);
}

const after = await getRemainingCustomQuestions(); // 0
// 6th question should return limit-exceeded response
```

### Test Template Rendering
```typescript
import { renderTemplate } from '../advisor/presets/renderTemplate';
import { buildDayContext } from '../advisor/context/buildDayContext';
import presetBank from '../advisor/presets/presetBank.json';

const context = buildDayContext();
const preset = presetBank.find(p => p.id === 'snack-between-meals');
const response = renderTemplate(preset, context);

console.log(response.directAnswer);
// Should contain actual values like "3h ago" instead of {hoursSinceLastMeal}
```

## Expanding the Preset Bank

### Add New Preset
1. Add entry to [presetBank.json](apps/mobile/src/advisor/presets/presetBank.json)
2. Follow the schema:
   ```json
   {
     "id": "unique-kebab-case",
     "title": "User-facing question",
     "tags": ["keyword1", "keyword2"],
     "utterances": ["variation 1", "variation 2", "variation 3"],
     "intent": "one of 11 intent types",
     "answerTemplate": "Use {variables} from context",
     "nextMovesTemplate": [3 items],
     "ifThenTemplate": [0-2 items],
     "whyTemplate": "Physiological explanation",
     "actionsTemplate": [optional buttons]
   }
   ```
3. Test matching: `matchPreset("your question")`
4. Add synonyms to [matchPreset.ts](apps/mobile/src/advisor/presets/matchPreset.ts) if needed

### Current Coverage (27 presets)
- Meal timing (breakfast, lunch, dinner, spacing, order)
- Snacking (between meals, hunger vs craving)
- Comfort meals (treats, desserts, alcohol)
- Caffeine timing (coffee, cutoff)
- Energy (low energy dips, afternoon crashes, naps)
- Sleep (bedtime, winddown)
- Stress management
- Workout timing (morning, evening, pre/post fuel)
- Fasting windows (extending, breaking)
- Schedule adjustments (meal shifts, travel)
- Special cases (eating out, weekend schedules, shift work)

### Goal: 100 Presets
- Add edge cases (jetlag, illness, holidays)
- Add more meal-specific questions (portions, prep timing)
- Add more exercise types (cardio, strength, HIIT)
- Add supplement timing (vitamins, minerals, protein powder)
- Add social scenarios (dates, parties, family meals)

## Performance

### Latency
- **Preset path**: <50ms (no network)
- **Clarify path**: <100ms (local matching only)
- **LLM path**: 1-3s (depends on API/OpenAI)

### Cost Optimization
- **27 presets** cover ~70% of questions (0 cost)
- **Clarify mode** converts another ~20% to presets (0 cost)
- **LLM calls** limited to ~10% of questions × 5/day limit
- **Estimated savings**: 95%+ reduction vs pure LLM approach

## Migration from Old Advisor

### Old Structure
```typescript
// OLD (nested)
{
  intent: { type, confidence, entities },
  advice: {
    directAnswer,
    nextMoves: [{ time, action, duration }],
    ifThen: [{ condition, action }],
    why,
    actions: [{ id, label, variant, payload }],
    inserts,
    suggestedActivity
  }
}
```

### New Structure
```typescript
// NEW (flat)
{
  source,  // NEW: preset|clarify|llm
  intent,  // Simplified enum
  directAnswer,
  nextMoves: [{ time?, title, reason? }],  // title (not action)
  ifThen: [{ if, then }],  // if/then (not condition/action)
  why,
  actions: [{ id, label, payload? }],  // no variant
  inserts?  // Optional, no suggestedActivity
}
```

### Breaking Changes
- `advice.directAnswer` → `directAnswer`
- `advice.nextMoves[].action` → `nextMoves[].title`
- `advice.ifThen[].condition` → `ifThen[].if`
- `advice.ifThen[].action` → `ifThen[].then`
- `getAdvisorResponse(context)` → `ask(question)` (async)
- Removed: `buildDecisionContext`, `getContextSummary`, `createActionExecutor`

## Environment Variables

```bash
# Backend API (preferred)
EXPO_PUBLIC_API_URL=https://your-api.com

# Direct OpenAI (fallback)
EXPO_PUBLIC_OPENAI_API_KEY=sk-...

# Neither: Advisor falls back to presets only + error for LLM path
```

## Future Enhancements

### Short-term
- [ ] Implement action execution (ADD_TO_PLAN, INSERT_WALK, etc)
- [ ] Add preset browser UI (category navigation)
- [ ] Add "Did this answer help?" feedback
- [ ] Track preset hit rate analytics

### Medium-term
- [ ] Expand preset bank to 100 questions
- [ ] Add voice input for questions
- [ ] Add quick reply suggestions after preset answers
- [ ] Personalized presets based on user history

### Long-term
- [ ] Multi-language presets
- [ ] Community-contributed presets
- [ ] ML-based preset generation from LLM responses
- [ ] Adaptive thresholds (adjust 0.72/0.45 based on success rate)

## License

Part of the AlignOS physiology engine project.
