/**
 * PHYSIOLOGY ENGINE API
 * Handles day state storage and sync for mobile clients.
 * Uses shared engine for server-side plan generation.
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { promises as fs } from 'fs';
import path from 'path';
import { generatePlan } from '@physiology-engine/engine';
import { 
  DayStateSchema, 
  EngineInputSchema,
  type DayState,
  type EngineInput 
} from '@physiology-engine/shared';

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, '../data');

// Middleware
app.use(cors());
app.use(express.json());

// Request logger
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// Ensure data directory exists
fs.mkdir(DATA_DIR, { recursive: true }).catch(console.error);

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
    const filePath = path.join(DATA_DIR, `${deviceId}_${dateKey}.json`);
    
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
 * POST /day/:deviceId/state
 * Save/update day state for a device
 */
app.post('/day/:deviceId/state', async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    const dayState: DayState = req.body;
    
    // Validate with zod
    const validated = DayStateSchema.parse(dayState);
    
    const dateKey = validated.dateKey || new Date().toISOString().split('T')[0];
    const filePath = path.join(DATA_DIR, `${deviceId}_${dateKey}.json`);
    
    // Save to file
    await fs.writeFile(filePath, JSON.stringify(validated, null, 2));
    
    res.json({ success: true, dateKey });
  } catch (error: any) {
    console.error('POST /day/:deviceId/state error:', error);
    if (error.name === 'ZodError') {
      res.status(400).json({ error: 'Invalid day state', details: error.errors });
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
    const { event, profile } = req.body;
    
    const dateKey = new Date().toISOString().split('T')[0];
    const filePath = path.join(DATA_DIR, `${deviceId}_${dateKey}.json`);
    
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
    
    // Add/update event
    dayState.events = [...dayState.events, event];
    
    // Recompute plan using engine
    const input: EngineInput = {
      now: new Date(),
      profile,
      dayState,
      options: { forceRecompute: true, stalenessThresholdMinutes: 15 },
    };
    
    const output = generatePlan(input);
    
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
    
    res.json({ success: true, output });
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
    const { profile } = req.body;
    
    const dateKey = new Date().toISOString().split('T')[0];
    const filePath = path.join(DATA_DIR, `${deviceId}_${dateKey}.json`);
    
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
    
    // Recompute with server now
    const input: EngineInput = {
      now: new Date(),
      profile,
      dayState,
      options: { forceRecompute: true, stalenessThresholdMinutes: 15 },
    };
    
    const output = generatePlan(input);
    
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
    
    res.json({ success: true, output });
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
    const filePath = path.join(DATA_DIR, `${deviceId}_${dateKey}.json`);
    
    const data = await fs.readFile(filePath, 'utf-8');
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${deviceId}_${dateKey}.json"`);
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
  console.log(`Data directory: ${DATA_DIR}`);
});

export default app;
