/**
 * PHYSIOLOGY ENGINE API
 * Handles day state storage and sync for mobile clients.
 * Uses shared engine for server-side plan generation.
 */

import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { promises as fs } from 'fs';
import path from 'path';
import { generatePlan } from '@physiology-engine/engine';
import { 
  DayStateSchema, 
  EngineInputSchema,
  type DayState,
  type EngineInput,
  type ClockTime,
} from '@physiology-engine/shared';
import advisorRoutes from './routes/advisorRoutes';
import {
  applyRhythmToSchedule,
  loadRhythmProfile,
  resetRhythmProfile,
  updateRhythmFromEvents,
} from './services/rhythmService';

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, '../data');
const RESOLVED_DATA_DIR = Array.isArray(DATA_DIR) ? DATA_DIR[0] : DATA_DIR;

// Middleware
app.use(cors());
app.use(express.json());

const hhmmToMinutes = (value?: string): number | undefined => {
  if (!value) return undefined;
  const match = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return undefined;
  const hours = Number.parseInt(match[1], 10);
  const minutes = Number.parseInt(match[2], 10);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return undefined;
  return hours * 60 + minutes;
};

const parseClockTime = (input?: string): ClockTime | null => {
  if (!input) return null;
  const withPeriod = input.match(/^(\d{1,2}):(\d{2})\s*([aApP][mM])$/);
  if (withPeriod) {
    const hour = Number.parseInt(withPeriod[1], 10);
    const minute = Number.parseInt(withPeriod[2], 10);
    const period = withPeriod[3].toUpperCase() as 'AM' | 'PM';
    if (hour < 1 || hour > 12 || minute < 0 || minute > 59) return null;
    return { hour, minute, period };
  }

  const hhmm = input.match(/^(\d{1,2}):(\d{2})$/);
  if (!hhmm) return null;
  const hour24 = Number.parseInt(hhmm[1], 10);
  const minute = Number.parseInt(hhmm[2], 10);
  if (hour24 < 0 || hour24 > 23 || minute < 0 || minute > 59) return null;
  return {
    hour: (hour24 % 12) || 12,
    minute,
    period: hour24 >= 12 ? 'PM' : 'AM',
  };
};

const clockFromISO = (iso?: string): ClockTime | null => {
  if (!iso) return null;
  const match = iso.match(/T(\d{2}):(\d{2})/);
  if (!match) return null;
  return parseClockTime(`${match[1]}:${match[2]}`);
};

const normalizeScheduleItemsForResponse = (items: any[]): any[] => {
  return items.map((item) => {
    const startISO = item.startISO || item.time?.toISOString?.() || item.time;
    const endISO = item.endISO || item.endTimeISO;
    const type = item.type || item.event?.type || 'custom';
    const startTime = item.startTime || clockFromISO(startISO || undefined) || parseClockTime(item.timeLabel);
    const endTime = item.endTime || clockFromISO(endISO || undefined);
    return {
      ...item,
      type,
      startISO,
      endISO,
      startTime: startTime || undefined,
      endTime: endTime || undefined,
      source:
        item.source === 'user' || item.source === 'advisor' || item.source === 'system'
          ? item.source
          : item.source === 'advisor_added'
            ? 'advisor'
            : item.source === 'user_added'
              ? 'user'
              : 'system',
      status:
        item.status === 'actual' || item.status === 'skipped' || item.status === 'adjusted'
          ? item.status
          : item.status === 'auto_adjusted'
            ? 'adjusted'
            : 'planned',
      locked: type === 'wake' || type === 'sleep',
      deletable: type !== 'wake' && type !== 'sleep',
    };
  });
};

const ISO_DATE_TIME_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?$/;

const coerceIsoDates = (input: any): any => {
  if (typeof input === 'string' && ISO_DATE_TIME_REGEX.test(input)) {
    const parsed = new Date(input);
    return Number.isNaN(parsed.getTime()) ? input : parsed;
  }

  if (Array.isArray(input)) {
    return input.map((item) => coerceIsoDates(item));
  }

  if (input && typeof input === 'object') {
    const normalized: Record<string, any> = {};
    for (const [key, value] of Object.entries(input)) {
      normalized[key] = coerceIsoDates(value);
    }
    return normalized;
  }

  return input;
};

// Helpers
const paramToString = (p?: string | string[] | null): string => (Array.isArray(p) ? p[0] : p ?? '');

// Request logger
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// Ensure data directory exists
fs.mkdir(DATA_DIR, { recursive: true }).catch(console.error);

// Mount advisor routes
app.use('/api', advisorRoutes);

// Check for OpenAI API key on startup
if (!process.env.OPENAI_API_KEY) {
  console.warn('⚠️  WARNING: OPENAI_API_KEY not set. Advisor endpoint will return fallback responses.');
} else {
  console.log('✅ OpenAI API key configured');
}

/**
 * GET /health
 * Health check endpoint
 */
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * GET /day/:deviceId/today
 * Get today's day state and computed plan for a device
 */
app.get('/day/:deviceId/today', async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    const dateKey = new Date().toISOString().split('T')[0];
    const filePath = path.join(DATA_DIR, `${paramToString(deviceId)}_${dateKey}.json`);
    
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      const dayState = JSON.parse(data, (key, value) => {
        // Revive Date objects
        if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
          return new Date(value);
        }
        return value;
      });
      
      res.json(dayState);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        res.status(404).json({ error: 'Day state not found' });
      } else {
        throw error;
      }
    }
  } catch (error) {
    console.error('GET /day/:deviceId/today error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /day/:deviceId/:date
 * Fetch a specific day's stored state and normalized full-day plan (YYYY-MM-DD)
 */
app.get('/day/:deviceId/:date(\\d{4}-\\d{2}-\\d{2})', async (req: Request, res: Response) => {
  try {
    const { deviceId, date } = req.params;
    const filePath = path.join(DATA_DIR, `${paramToString(deviceId)}_${date}.json`);

    try {
      const data = await fs.readFile(filePath, 'utf-8');
      const dayState = JSON.parse(data, (key, value) => {
        if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
          return new Date(value);
        }
        return value;
      });

      const historicalEntries = Array.isArray(dayState?.todayEntries)
        ? normalizeScheduleItemsForResponse(dayState.todayEntries)
        : [];

      const storedItems = Array.isArray(dayState?.fullDayPlan?.items)
        ? dayState.fullDayPlan.items
        : historicalEntries.length
          ? historicalEntries
        : normalizeScheduleItemsForResponse(dayState?.computedPlan || []);

      return res.json({
        dateISO: date,
        dayState: {
          dayMode: dayState?.dayMode,
          sleepQuality: dayState?.sleepQuality,
          stressLevel: dayState?.stressLevel,
          currentTime: dayState?.currentTime,
        },
        fullDayPlan: {
          dateISO: date,
          items: storedItems,
          summary: dayState?.fullDayPlan?.summary || dayState?.planMeta?.dayOneLiner,
          recommendations: dayState?.fullDayPlan?.recommendations || [],
        },
        todayEntries: historicalEntries,
      });
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return res.status(404).json({ error: 'Day state not found' });
      }
      throw error;
    }
  } catch (error) {
    console.error('GET /day/:deviceId/:date error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /day/:deviceId/:date/timeline
 * Persist timeline-only updates (todayEntries/fullDayPlan) for a specific date.
 */
app.post('/day/:deviceId/:date(\\d{4}-\\d{2}-\\d{2})/timeline', async (req: Request, res: Response) => {
  try {
    const { deviceId, date } = req.params;
    const filePath = path.join(DATA_DIR, `${paramToString(deviceId)}_${date}.json`);

    let existing: any;
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      existing = JSON.parse(data, (key, value) => {
        if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
          return new Date(value);
        }
        return value;
      });
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return res.status(404).json({ error: 'Day state not found' });
      }
      throw error;
    }

    const incomingEntries = Array.isArray(req.body?.todayEntries)
      ? normalizeScheduleItemsForResponse(req.body.todayEntries)
      : undefined;

    const incomingFullDayPlan = req.body?.fullDayPlan && typeof req.body.fullDayPlan === 'object'
      ? {
          ...req.body.fullDayPlan,
          dateISO: date,
          items: Array.isArray(req.body.fullDayPlan.items)
            ? normalizeScheduleItemsForResponse(req.body.fullDayPlan.items)
            : Array.isArray(existing?.fullDayPlan?.items)
              ? existing.fullDayPlan.items
              : [],
        }
      : undefined;

    const updated = {
      ...existing,
      todayEntries: incomingEntries ?? existing?.todayEntries ?? [],
      fullDayPlan: incomingFullDayPlan ?? existing?.fullDayPlan,
      syncedAt: new Date().toISOString(),
    };

    await fs.writeFile(filePath, JSON.stringify(updated, null, 2));

    return res.json({
      success: true,
      dateISO: date,
      todayEntriesCount: Array.isArray(updated.todayEntries) ? updated.todayEntries.length : 0,
      fullDayPlanItemsCount: Array.isArray(updated.fullDayPlan?.items) ? updated.fullDayPlan.items.length : 0,
    });
  } catch (error) {
    console.error('POST /day/:deviceId/:date/timeline error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /day/:deviceId/tomorrow
 * Return tomorrow preview or lightweight template based on available state
 */
app.get('/day/:deviceId/tomorrow', async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateKey = tomorrow.toISOString().split('T')[0];
    const tomorrowPath = path.join(DATA_DIR, `${paramToString(deviceId)}_${dateKey}.json`);

    try {
      const data = await fs.readFile(tomorrowPath, 'utf-8');
      const tomorrowState = JSON.parse(data);

      if (Array.isArray(tomorrowState?.items) && tomorrowState.items.length > 0) {
        const normalizedItems = normalizeScheduleItemsForResponse(tomorrowState.items);
        const anchors = Array.isArray(tomorrowState.anchors) && tomorrowState.anchors.length
          ? tomorrowState.anchors
          : normalizedItems.slice(0, 10).map((item: any) => ({
              title: item.title,
              time: `${String(Math.floor((item.startMin || 0) / 60)).padStart(2, '0')}:${String((item.startMin || 0) % 60).padStart(2, '0')}`,
            }));

        return res.json({
          ...tomorrowState,
          dateKey,
          source: tomorrowState?.source || 'saved',
          items: normalizedItems,
          anchors,
        });
      }

      return res.json({
        dateKey,
        source: 'saved',
        wakeTime: '07:00',
        sleepTime: '23:00',
        wakeMin: hhmmToMinutes('07:00'),
        sleepMin: hhmmToMinutes('23:00'),
        workStartTime: tomorrowState?.workStartTime,
        workEndTime: tomorrowState?.workEndTime,
        workStartMin: hhmmToMinutes(tomorrowState?.workStartTime),
        workEndMin: hhmmToMinutes(tomorrowState?.workEndTime),
        anchors: [
          { title: 'Meal 1', time: '08:30', timeMin: hhmmToMinutes('08:30') },
          { title: 'Lunch', time: '12:30', timeMin: hhmmToMinutes('12:30') },
          { title: 'Workout / Walk', time: '17:30', timeMin: hhmmToMinutes('17:30') },
        ],
      });
    } catch {
      const todayKey = new Date().toISOString().split('T')[0];
      const todayPath = path.join(DATA_DIR, `${paramToString(deviceId)}_${todayKey}.json`);
      let wakeTime = '07:00';
      let sleepTime = '23:00';

      try {
        const todayData = await fs.readFile(todayPath, 'utf-8');
        const todayState = JSON.parse(todayData);
        const events = todayState?.computedPlan || [];
        const wake = events.find((event: any) => event?.event?.type === 'activation-routine');
        if (wake?.time) {
          const wakeDate = new Date(wake.time);
          wakeTime = `${String(wakeDate.getHours()).padStart(2, '0')}:${String(wakeDate.getMinutes()).padStart(2, '0')}`;
        }
      } catch {
        // Fallback template remains
      }

      return res.json({
        dateKey,
        source: 'template',
        wakeTime,
        sleepTime,
        wakeMin: hhmmToMinutes(wakeTime),
        sleepMin: hhmmToMinutes(sleepTime),
        anchors: [
          { title: 'Meal 1', time: '08:30', timeMin: hhmmToMinutes('08:30') },
          { title: 'Lunch', time: '12:30', timeMin: hhmmToMinutes('12:30') },
          { title: 'Workout / Walk', time: '17:30', timeMin: hhmmToMinutes('17:30') },
        ],
      });
    }
  } catch (error) {
    console.error('GET /day/:deviceId/tomorrow error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /day/:deviceId/tomorrow/generate
 * Generate tomorrow preview/state using profile + rhythm aggregates and store by tomorrow date key
 */
app.post('/day/:deviceId/tomorrow/generate', async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    const { profile, preview } = req.body || {};
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateKey = tomorrow.toISOString().split('T')[0];
    const tomorrowPath = path.join(DATA_DIR, `${paramToString(deviceId)}_${dateKey}.json`);

    if (preview && Array.isArray(preview.items) && preview.items.length > 0) {
      const normalizedItems = normalizeScheduleItemsForResponse(preview.items);
      const persistedPreview = {
        ...preview,
        dateKey,
        dateISO: preview.dateISO || dateKey,
        items: normalizedItems,
        source: 'generated-mobile',
        generatedAt: new Date().toISOString(),
      };

      await fs.writeFile(tomorrowPath, JSON.stringify(persistedPreview, null, 2));
      return res.json({ success: true, ...persistedPreview });
    }

    const rhythm = await loadRhythmProfile(RESOLVED_DATA_DIR, paramToString(deviceId));
    const wakeTime = rhythm.rollingMedians.wake || profile?.wakeTime || '07:00';
    const sleepTime = rhythm.rollingMedians.sleep || profile?.sleepTime || '23:00';
    const workStartTime = profile?.workStartTime;
    const workEndTime = profile?.workEndTime;
    const lunchTime = rhythm.rollingMedians.lunch || profile?.lunchTime || '12:30';

    const anchors = [
      { title: 'Meal 1', time: rhythm.rollingMedians.firstMeal || '08:30' },
      { title: 'Lunch', time: lunchTime },
      { title: 'Workout / Walk', time: rhythm.commonBins.workout?.[0] || rhythm.commonBins.walk?.[0] || '17:30' },
    ];

    const suggestions = [
      rhythm.commonBins.workout?.[0]
        ? `Best workout window is around ${rhythm.commonBins.workout[0]}; place your main session there.`
        : 'Protect a 45–60 minute movement block in late afternoon.',
      rhythm.disruptionWindows?.length
        ? `You often edit around ${rhythm.disruptionWindows[0]}:00; add buffer around that hour.`
        : 'Keep lunch fixed to stabilize your afternoon energy.',
      rhythm.adherenceScore >= 0.7
        ? 'Adherence is strong; copy your core anchors from today.'
        : 'Use fewer but firmer anchors tomorrow to improve adherence.',
    ];

    const generatedState = {
      dateKey,
      generatedAt: new Date().toISOString(),
      wakeTime,
      sleepTime,
      wakeMin: hhmmToMinutes(wakeTime),
      sleepMin: hhmmToMinutes(sleepTime),
      workStartTime,
      workEndTime,
      workStartMin: hhmmToMinutes(workStartTime),
      workEndMin: hhmmToMinutes(workEndTime),
      lunchTime,
      lunchStartMin: hhmmToMinutes(lunchTime),
      anchors: anchors.map((anchor) => ({
        ...anchor,
        timeMin: hhmmToMinutes(anchor.time),
      })),
      suggestions,
      source: 'generated',
    };

    await fs.writeFile(tomorrowPath, JSON.stringify(generatedState, null, 2));
    res.json({ success: true, ...generatedState });
  } catch (error) {
    console.error('POST /day/:deviceId/tomorrow/generate error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /day/:deviceId/rhythm
 * Return learned rhythm aggregates for device
 */
app.get('/day/:deviceId/rhythm', async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    const rhythm = await loadRhythmProfile(RESOLVED_DATA_DIR, paramToString(deviceId));
    res.json(rhythm);
  } catch (error) {
    console.error('GET /day/:deviceId/rhythm error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /day/:deviceId/rhythm/reset
 * Reset learned rhythm aggregates for device
 */
app.post('/day/:deviceId/rhythm/reset', async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    const rhythm = await resetRhythmProfile(RESOLVED_DATA_DIR, paramToString(deviceId));
    res.json({ success: true, rhythm });
  } catch (error) {
    console.error('POST /day/:deviceId/rhythm/reset error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /day/:deviceId/state
 * Save/update day state for a device
 */
app.post('/day/:deviceId/state', async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    const rawPayload = req.body || {};
    const rawDayState = rawPayload.dayState || rawPayload;
    const normalizedDayState = coerceIsoDates(rawDayState);
    
    // Validate with zod
    const validated = DayStateSchema.parse(normalizedDayState);
    
    const dateKey = validated.dateKey || new Date().toISOString().split('T')[0];
    const filePath = path.join(DATA_DIR, `${paramToString(deviceId)}_${dateKey}.json`);
    
    const persisted: any = {
      ...validated,
    };

    if (rawPayload.fullDayPlan) {
      persisted.fullDayPlan = rawPayload.fullDayPlan;
    }
    if (Array.isArray(rawPayload.todayEntries)) {
      persisted.todayEntries = rawPayload.todayEntries;
    }
    if (rawPayload.syncedAt) {
      persisted.syncedAt = rawPayload.syncedAt;
    }

    // Save to file
    await fs.writeFile(filePath, JSON.stringify(persisted, null, 2));
    
    res.json({ success: true, dateKey, hasFullDayPlan: !!persisted.fullDayPlan, todayEntriesCount: Array.isArray(persisted.todayEntries) ? persisted.todayEntries.length : 0 });
  } catch (error: any) {
    const errorName = typeof error?.name === 'string' ? error.name : 'UnknownError';
    const errorMessage = typeof error?.message === 'string' ? error.message : String(error);
    const errorStack = typeof error?.stack === 'string' ? error.stack : undefined;

    console.error(`POST /day/:deviceId/state error: ${errorName}: ${errorMessage}`);
    if (errorStack) {
      console.error(errorStack);
    }

    if (errorName === 'ZodError') {
      const details = Array.isArray(error?.errors) ? error.errors : [];
      res.status(400).json({ error: 'Invalid day state', details });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

/**
 * POST /day/:deviceId/events
 * Add/update events and recompute plan
 */
app.post('/day/:deviceId/events', async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    const { event, events, profile } = req.body;
    const incomingEvents = Array.isArray(events)
      ? events
      : event
        ? [event]
        : [];
    
    const dateKey = new Date().toISOString().split('T')[0];
    const filePath = path.join(RESOLVED_DATA_DIR, `${paramToString(deviceId)}_${dateKey}.json`);
    
    // Load existing state
    let dayState: DayState;
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      dayState = JSON.parse(data, (key, value) => {
        if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
          return new Date(value);
        }
        return value;
      });
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return res.status(404).json({ error: 'Day state not found. Create state first.' });
      }
      throw error;
    }
    
    // Add/update events
    dayState.events = [...dayState.events, ...incomingEvents];
    
    // Recompute plan using engine
    const input: EngineInput = {
      now: new Date(),
      profile,
      dayState,
      options: { forceRecompute: true, stalenessThresholdMinutes: 15 },
    };
    
    const output = generatePlan(input);

    const rhythm = await updateRhythmFromEvents(RESOLVED_DATA_DIR, paramToString(deviceId), dayState, profile, incomingEvents);
    output.scheduleItems = applyRhythmToSchedule(output.scheduleItems, rhythm, profile);
    
    // Update day state with new computed plan
    dayState.lastComputedAt = new Date();
    dayState.computedPlan = output.scheduleItems;
    dayState.planMeta = {
      mode: dayState.dayMode,
      score: output.score,
      dayOneLiner: output.dayInOneLine,
      warnings: output.warnings,
    };
    
    // Save updated state
    await fs.writeFile(filePath, JSON.stringify(dayState, null, 2));
    
    res.json({
      success: true,
      output: {
        ...output,
        scheduleItems: normalizeScheduleItemsForResponse(output.scheduleItems),
      },
      rhythm,
    });
  } catch (error: any) {
    console.error('POST /day/:deviceId/events error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /day/:deviceId/recompute
 * Force recompute plan with server time
 */
app.post('/day/:deviceId/recompute', async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    const { profile, intent, baseItems } = req.body;
    
    const dateKey = new Date().toISOString().split('T')[0];
    const filePath = path.join(DATA_DIR, `${paramToString(deviceId)}_${dateKey}.json`);
    
    // Load existing state
    let dayState: DayState;
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      dayState = JSON.parse(data, (key, value) => {
        if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
          return new Date(value);
        }
        return value;
      });
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return res.status(404).json({ error: 'Day state not found' });
      }
      throw error;
    }
    
    if (intent === 'DELETE' && Array.isArray(baseItems)) {
      const normalizedBaseItems = normalizeScheduleItemsForResponse(baseItems);
      dayState.lastComputedAt = new Date();
      dayState.computedPlan = normalizedBaseItems;

      await fs.writeFile(filePath, JSON.stringify(dayState, null, 2));

      return res.json({
        success: true,
        output: {
          score: dayState.planMeta?.score ?? 0,
          dayInOneLine: dayState.planMeta?.dayOneLiner ?? 'Delete mutation applied',
          scheduleItems: normalizedBaseItems,
          warnings: ['Delete-intent recompute skipped auto-generation'],
          recomputeHints: {
            staleness: 'FRESH',
            reasons: ['delete-intent-validate-only'],
          },
        },
      });
    }

    // Recompute with server now
    const input: EngineInput = {
      now: new Date(),
      profile,
      dayState,
      options: { forceRecompute: true, stalenessThresholdMinutes: 15 },
    };
    
    const output = generatePlan(input);
    const rhythm = await loadRhythmProfile(RESOLVED_DATA_DIR, paramToString(deviceId));
    output.scheduleItems = applyRhythmToSchedule(output.scheduleItems, rhythm, profile);
    
    // Update state
    dayState.lastComputedAt = new Date();
    dayState.computedPlan = output.scheduleItems;
    dayState.planMeta = {
      mode: dayState.dayMode,
      score: output.score,
      dayOneLiner: output.dayInOneLine,
      warnings: output.warnings,
    };
    
    await fs.writeFile(filePath, JSON.stringify(dayState, null, 2));
    
    res.json({
      success: true,
      output: {
        ...output,
        scheduleItems: normalizeScheduleItemsForResponse(output.scheduleItems),
      },
      rhythm,
    });
  } catch (error) {
    console.error('POST /day/:deviceId/recompute error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /day/:deviceId/export/today
 * Export today's state as JSON download
 */
app.get('/day/:deviceId/export/today', async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    const dateKey = new Date().toISOString().split('T')[0];
    const filePath = path.join(RESOLVED_DATA_DIR, `${paramToString(deviceId)}_${dateKey}.json`);
    
    const data = await fs.readFile(filePath, 'utf-8');
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${paramToString(deviceId)}_${dateKey}.json"`);
    res.send(data);
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      res.status(404).json({ error: 'Day state not found' });
    } else {
      console.error('GET /day/:deviceId/export/today error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`API server listening on port ${PORT}`);
  console.log(`Data directory: ${RESOLVED_DATA_DIR}`);
});

export default app;
