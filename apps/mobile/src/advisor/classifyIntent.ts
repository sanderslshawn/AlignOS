/**
 * AlignOS AI Advisor - Intent Classifier
 * Deterministic pattern matching for user queries
 */

import type { ClassifiedIntent, IntentType } from './types';

const intentPatterns: Record<IntentType, RegExp[]> = {
  meal_timing: [
    /when (should|can) (i|we) (eat|have)/i,
    /best time (for|to) (eat|have)/i,
    /(timing|schedule) (for|of) (breakfast|lunch|dinner|meal)/i,
    /what time.*?(eat|meal|breakfast|lunch|dinner)/i,
  ],
  
  snack_between_meals: [
    /can i snack/i,
    /snack(ing)? between meals/i,
    /(should|can) i eat between/i,
    /snack.*?(allowed|ok|fine)/i,
  ],
  
  comfort_meal: [
    /comfort meal/i,
    /off.?plan meal/i,
    /(cheat|treat) meal/i,
    /flexibility.*?eating/i,
    /(pudding|ice cream|dessert|treat|pizza|fries|burger)/i,
    /sweet|candy|chocolate/i,
    /craving/i,
    /when.*?(have|eat).*?(pudding|ice cream|dessert|treat)/i,
  ],
  
  caffeine_timing: [
    /coffee/i,
    /caffeine/i,
    /when.*?(drink|have).*?(coffee|caffeine|espresso)/i,
  ],
  
  workout_timing: [
    /when.*?(workout|train|exercise)/i,
    /best time.*?(workout|training|gym)/i,
    /(morning|evening).*(workout|training)/i,
  ],
  
  low_energy_dip: [
    /tired at/i,
    /energy dip/i,
    /why.*?(tired|sleepy|low energy)/i,
    /(afternoon|midday|3.*?pm).*?(crash|dip|tired)/i,
  ],
  
  sleep_quality: [
    /sleep/i,
    /rest/i,
    /can'?t.*?sleep/i,
    /insomnia/i,
    /wind.?down/i,
  ],
  
  stress_management: [
    /stress/i,
    /anxious/i,
    /overwhelmed/i,
    /anxiety/i,
  ],
  
  schedule_adjustment: [
    /shift.*?(schedule|plan)/i,
    /adjust.*?(time|schedule)/i,
    /move.*?(activity|workout|meal)/i,
    /reschedule/i,
  ],
  
  general_question: [
    /how.*?work/i,
    /what.*?is/i,
    /explain/i,
    /why.*?(science|research)/i,
  ],
};

const foodPatterns = {
  mealTypes: /(breakfast|lunch|dinner|meal)/i,
  specificFoods: /(chicken|beef|fish|pasta|rice|pudding|salad|steak|burger|pizza|banana)/i,
};

export function classifyIntent(query: string): ClassifiedIntent {
  const lowerQuery = query.toLowerCase();
  
  // Try to match each intent pattern
  for (const [intentType, patterns] of Object.entries(intentPatterns)) {
    for (const pattern of patterns) {
      if (pattern.test(lowerQuery)) {
        // Extract entities
        const entities: any = {};
        
        const mealMatch = query.match(foodPatterns.mealTypes);
        if (mealMatch) entities.mealType = mealMatch[1];
        
        const foodMatch = query.match(foodPatterns.specificFoods);
        if (foodMatch) entities.specificFood = foodMatch[1];
        
        if (/morning/i.test(query)) entities.timeFrame = 'morning';
        if (/afternoon|midday/i.test(query)) entities.timeFrame = 'afternoon';
        if (/evening|night/i.test(query)) entities.timeFrame = 'evening';
        
        return {
          type: intentType as IntentType,
          confidence: 0.85,
          entities,
        };
      }
    }
  }
  
  // Default to general question
  return {
    type: 'general_question',
    confidence: 0.5,
    entities: {},
  };
}
