/**
 * Usage Store for Advisor Daily Limits
 * File-based persistence for tracking LLM calls per device per day
 */

import { promises as fs } from 'fs';
import path from 'path';

const DATA_DIR = path.join(__dirname, '../../data');
const USAGE_FILE = path.join(DATA_DIR, 'advisor-usage.json');
const DAILY_LIMIT = parseInt(process.env.ADVISOR_DAILY_LIMIT || '5', 10);
const CLEANUP_DAYS = 7; // Remove entries older than 7 days

interface UsageRecord {
  [key: string]: number; // deviceId_YYYY-MM-DD → count
}

/**
 * Get today's date key (YYYY-MM-DD)
 */
function getTodayKey(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Build storage key for device + date
 */
function buildKey(deviceId: string, date?: string): string {
  const dateKey = date || getTodayKey();
  return `${deviceId}_${dateKey}`;
}

/**
 * Load usage data from file
 */
async function loadUsage(): Promise<UsageRecord> {
  try {
    // Ensure data directory exists
    await fs.mkdir(DATA_DIR, { recursive: true });
    
    // Read file
    const content = await fs.readFile(USAGE_FILE, 'utf-8');
    const data = JSON.parse(content);
    
    // Cleanup old entries
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - CLEANUP_DAYS);
    const cutoffKey = cutoffDate.toISOString().split('T')[0];
    
    const cleaned: UsageRecord = {};
    for (const [key, count] of Object.entries(data)) {
      const dateStr = key.split('_').pop();
      if (dateStr && dateStr >= cutoffKey) {
        cleaned[key] = count as number;
      }
    }
    
    return cleaned;
  } catch (error: any) {
    // File doesn't exist yet - return empty
    if (error.code === 'ENOENT') {
      return {};
    }
    console.error('Failed to load usage data:', error.message);
    return {};
  }
}

/**
 * Save usage data to file
 */
async function saveUsage(data: UsageRecord): Promise<void> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(USAGE_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error: any) {
    console.error('Failed to save usage data:', error.message);
  }
}

/**
 * Get usage count for device today
 */
export async function getUsageToday(deviceId: string): Promise<number> {
  const data = await loadUsage();
  const key = buildKey(deviceId);
  return data[key] || 0;
}

/**
 * Increment usage for device today
 */
export async function incrementUsage(deviceId: string): Promise<void> {
  const data = await loadUsage();
  const key = buildKey(deviceId);
  data[key] = (data[key] || 0) + 1;
  await saveUsage(data);
}

/**
 * Get remaining quota for device today
 */
export async function getRemainingQuota(deviceId: string): Promise<number> {
  const used = await getUsageToday(deviceId);
  return Math.max(0, DAILY_LIMIT - used);
}

/**
 * Get daily limit
 */
export function getDailyLimit(): number {
  return DAILY_LIMIT;
}

/**
 * Reset usage for a device (admin function)
 */
export async function resetUsage(deviceId: string): Promise<void> {
  const data = await loadUsage();
  const key = buildKey(deviceId);
  delete data[key];
  await saveUsage(data);
}
