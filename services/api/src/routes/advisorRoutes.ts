/**
 * Advisor Routes
 * Express router for POST /api/advisor endpoint
 */

import express from 'express';
import rateLimit from 'express-rate-limit';
import { AdvisorRequestSchema } from '../schemas/advisorSchema';
import { processAdvisorRequest } from '../services/advisorService';

const router = express.Router();

// Rate limiter to prevent abuse
const advisorLimiter = rateLimit({
  windowMs: parseInt(process.env.ADVISOR_RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 min default
  max: parseInt(process.env.ADVISOR_RATE_LIMIT_MAX_REQUESTS || '20', 10),
  message: { error: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: any) => {
    // Rate limit by deviceId if available, otherwise IP
    const deviceId = req.body?.deviceId;
    return deviceId || req.ip || 'unknown';
  }
});

/**
 * POST /api/advisor
 * Main advisor endpoint
 */
router.post('/advisor', advisorLimiter as any, async (req, res) => {
  try {
    // Validate request body
    const validated = AdvisorRequestSchema.parse(req.body);
    
    // Process request
    const result = await processAdvisorRequest(
      validated.deviceId,
      validated.message,
      validated.dayContext
    );
    
    // Return response
    res.json(result);
    
  } catch (error: any) {
    console.error('POST /api/advisor error:', error.message);
    
    // Validation error
    if (error.name === 'ZodError') {
      return res.status(400).json({
        error: 'Invalid request format',
        details: error.errors
      });
    }
    
    // Generic error
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/advisor/health
 * Health check endpoint
 */
router.get('/advisor/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    hasApiKey: !!process.env.OPENAI_API_KEY
  });
});

export default router;
