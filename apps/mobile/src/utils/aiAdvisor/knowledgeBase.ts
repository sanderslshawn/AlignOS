/**
 * AlignOS AI Advisor - Knowledge Base
 * 
 * Structured physiology knowledge domains for context-aware behavioral guidance.
 * This is NOT a generic chatbot - it's a physiology-informed regulation engine.
 */

export type KnowledgeDomain = 
  | 'circadian'
  | 'meal_timing'
  | 'energy'
  | 'movement'
  | 'stress'
  | 'cognitive'
  | 'sleep'
  | 'adherence';

export interface KnowledgeEntry {
  domain: KnowledgeDomain;
  topic: string;
  principle: string;
  timingRules: string[];
  contraindications: string[];
  contextFactors: string[];
}

/**
 * Structured knowledge base - organized by domain
 */
export const KNOWLEDGE_BASE: Record<KnowledgeDomain, KnowledgeEntry[]> = {
  
  // ========================================
  // CIRCADIAN BIOLOGY
  // ========================================
  circadian: [
    {
      domain: 'circadian',
      topic: 'cortisol_rhythm',
      principle: 'Cortisol peaks 30-45 minutes after waking (CAR - Cortisol Awakening Response). This drives alertness and glucose mobilization.',
      timingRules: [
        'Peak alertness: 1-3 hours post-wake',
        'Avoid carbs during cortisol peak (blunts natural energy)',
        'Light exposure within 30 min of waking anchors rhythm',
      ],
      contraindications: [
        'High stress delays cortisol decline',
        'Poor sleep disrupts CAR amplitude',
      ],
      contextFactors: ['wake_time', 'sleep_quality', 'stress_level'],
    },
    {
      domain: 'circadian',
      topic: 'afternoon_dip',
      principle: 'Natural circadian dip occurs 7-9 hours post-wake (2-4 PM for most). This is adenosine accumulation + post-lunch glucose drop.',
      timingRules: [
        'Expect reduced alertness 2-4 PM',
        'Light movement or 10-min walk restores focus',
        'Avoid large carb meals at lunch',
        'Caffeine 30 min before dip can prevent crash',
      ],
      contraindications: [
        'Caffeine after 2 PM impacts sleep onset',
      ],
      contextFactors: ['current_time', 'last_meal', 'caffeine_timing'],
    },
    {
      domain: 'circadian',
      topic: 'evening_wind_down',
      principle: 'Melatonin onset begins 2-3 hours before sleep. Light, temperature, and activity must align.',
      timingRules: [
        'Dim lights 2 hours before target sleep',
        'Screen time ends 1 hour pre-sleep',
        'Last meal 3 hours before sleep',
        'Room temp drops to 65-68°F',
      ],
      contraindications: [
        'Blue light delays melatonin by 1-2 hours',
        'Late meals delay sleep onset',
      ],
      contextFactors: ['sleep_target', 'last_meal', 'screen_time'],
    },
    {
      domain: 'circadian',
      topic: 'chronotype',
      principle: 'Genetic chronotype affects optimal timing. Early chronotypes peak earlier; late chronotypes peak later.',
      timingRules: [
        'Early types: workout 7-10 AM, sleep by 10 PM',
        'Late types: workout 4-7 PM, sleep by 11:30 PM',
        'Social jetlag disrupts both types',
      ],
      contraindications: [
        'Forcing early type to late schedule increases cortisol',
      ],
      contextFactors: ['wake_time', 'sleep_time', 'energy_pattern'],
    },
  ],

  // ========================================
  // MEAL TIMING PHYSIOLOGY
  // ========================================
  meal_timing: [
    {
      domain: 'meal_timing',
      topic: 'protein_first',
      principle: 'Eating protein first blunts glucose spike, increases GLP-1, and reduces ghrelin. This improves satiety and metabolic response.',
      timingRules: [
        'Start meals with 20-30g protein',
        'Wait 10-15 min before carbs',
        'Fiber second, carbs last',
      ],
      contraindications: [
        'Not applicable for liquid meals (absorption too fast)',
      ],
      contextFactors: ['meal_composition', 'hunger_level'],
    },
    {
      domain: 'meal_timing',
      topic: 'fasting_window',
      principle: 'Time-restricted feeding (12-16 hour fast) improves insulin sensitivity, promotes autophagy, and aligns with circadian rhythm.',
      timingRules: [
        '12-hour minimum (dinner to breakfast)',
        '14-16 hours optimal for metabolic health',
        'First meal within 1 hour of waking for early types',
        'First meal 2-3 hours post-wake for late types',
      ],
      contraindications: [
        'Not recommended for muscle gain priorities',
        'Avoid if sleep-deprived or high-stress',
      ],
      contextFactors: ['fitness_goal', 'sleep_quality', 'stress_level'],
    },
    {
      domain: 'meal_timing',
      topic: 'meal_spacing',
      principle: 'Optimal spacing is 3-5 hours between meals. Insulin must return to baseline before next meal for metabolic flexibility.',
      timingRules: [
        'Minimum 3 hours between meals',
        '4-5 hours ideal for fat oxidation',
        'Avoid snacking between meals',
      ],
      contraindications: [
        'High-intensity training may require intra-workout nutrition',
      ],
      contextFactors: ['last_meal', 'activity_level', 'fitness_goal'],
    },
    {
      domain: 'meal_timing',
      topic: 'late_night_eating',
      principle: 'Eating within 3 hours of sleep disrupts glucose metabolism, delays melatonin, and impairs sleep quality.',
      timingRules: [
        'Last meal 3-4 hours before sleep',
        'If late meal necessary: protein-dominant, low-carb',
        'Avoid alcohol within 4 hours of sleep',
      ],
      contraindications: [
        'Late eating increases cortisol and disrupts REM',
      ],
      contextFactors: ['sleep_time', 'last_meal', 'meal_size'],
    },
    {
      domain: 'meal_timing',
      topic: 'carb_timing',
      principle: 'Carbs are best timed around activity (pre/post workout) or early in day when insulin sensitivity is highest.',
      timingRules: [
        'Highest carbs: post-workout or breakfast',
        'Moderate carbs: lunch',
        'Lowest carbs: dinner (unless evening workout)',
      ],
      contraindications: [
        'High carbs at dinner delay sleep and impair fat oxidation',
      ],
      contextFactors: ['workout_timing', 'fitness_goal', 'sleep_quality'],
    },
  ],

  // ========================================
  // ENERGY REGULATION
  // ========================================
  energy: [
    {
      domain: 'energy',
      topic: 'caffeine_timing',
      principle: 'Caffeine has 5-6 hour half-life. Blocks adenosine (sleep pressure). Must be timed relative to wake and sleep.',
      timingRules: [
        'First caffeine: 90-120 min post-wake (allows cortisol to peak naturally)',
        'Last caffeine: 8-10 hours before sleep',
        'Avoid caffeine after 2 PM for 10 PM sleep',
      ],
      contraindications: [
        'Caffeine too early blunts cortisol awakening response',
        'Caffeine too late delays sleep onset by 1-2 hours',
      ],
      contextFactors: ['wake_time', 'sleep_time', 'last_caffeine'],
    },
    {
      domain: 'energy',
      topic: 'glucose_stability',
      principle: 'Blood glucose variability causes energy crashes. Protein + fiber stabilize glucose. Refined carbs alone spike then crash.',
      timingRules: [
        'Pair carbs with protein (1:1 ratio or higher protein)',
        'Include fiber to slow digestion',
        'Avoid solo carb snacks',
      ],
      contraindications: [
        'High GI foods alone cause reactive hypoglycemia',
      ],
      contextFactors: ['meal_composition', 'activity_level'],
    },
    {
      domain: 'energy',
      topic: 'hydration_energy',
      principle: 'Even 2% dehydration reduces cognitive performance and increases perceived fatigue. Front-load hydration in AM.',
      timingRules: [
        '16-24 oz water upon waking',
        '0.5 oz per lb bodyweight daily',
        'Front-load: 60% by 2 PM',
      ],
      contraindications: [
        'Excess water within 2 hours of sleep disrupts sleep',
      ],
      contextFactors: ['activity_level', 'temperature', 'last_hydration'],
    },
  ],

  // ========================================
  // MOVEMENT SCIENCE
  // ========================================
  movement: [
    {
      domain: 'movement',
      topic: 'post_meal_walk',
      principle: 'Walking 10-15 min after meal improves glucose clearance by 20-30%, reduces post-meal lethargy.',
      timingRules: [
        'Walk within 15-30 min post-meal',
        'Duration: 10-20 minutes',
        'Intensity: conversational pace',
      ],
      contraindications: [
        'Not needed after pure protein meals',
      ],
      contextFactors: ['meal_size', 'meal_composition'],
    },
    {
      domain: 'movement',
      topic: 'strength_training_timing',
      principle: 'Strength training is optimized 3-4 hours post-wake when body temp peaks and muscle activation is highest.',
      timingRules: [
        'Optimal: 3-6 hours post-wake',
        'Pre-workout meal: 60-90 min before',
        'Post-workout meal: within 60 min',
      ],
      contraindications: [
        'Training within 4 hours of sleep elevates cortisol and delays sleep',
      ],
      contextFactors: ['wake_time', 'sleep_time', 'last_meal'],
    },
    {
      domain: 'movement',
      topic: 'zone2_cardio',
      principle: 'Zone 2 cardio (conversational pace) improves mitochondrial function and fat oxidation without stress response.',
      timingRules: [
        'Best: fasted AM or 3+ hours post-meal',
        'Duration: 30-60 minutes',
        'Frequency: 3-4x per week',
      ],
      contraindications: [
        'Avoid zone 2 if sleep-deprived (increases cortisol)',
      ],
      contextFactors: ['sleep_quality', 'stress_level', 'last_meal'],
    },
  ],

  // ========================================
  // STRESS PHYSIOLOGY
  // ========================================
  stress: [
    {
      domain: 'stress',
      topic: 'sympathetic_dominance',
      principle: 'Chronic sympathetic activation impairs digestion, sleep, and recovery. Must actively trigger parasympathetic.',
      timingRules: [
        'Box breathing: 4-4-4-4, 5 min minimum',
        'Practice after stressful events or before meals',
        'Evening routine: 10 min breathwork',
      ],
      contraindications: [
        'Eating in sympathetic state impairs digestion',
      ],
      contextFactors: ['stress_level', 'heart_rate_variability'],
    },
    {
      domain: 'stress',
      topic: 'cortisol_management',
      principle: 'Elevated evening cortisol delays melatonin and impairs sleep. Must be actively lowered via temperature, light, and routine.',
      timingRules: [
        'Avoid intense exercise within 4 hours of sleep',
        'Dim lights after sunset',
        'Cool shower 90 min before sleep',
      ],
      contraindications: [
        'Caffeine after 2 PM elevates evening cortisol',
        'Late meals elevate cortisol',
      ],
      contextFactors: ['sleep_time', 'stress_level', 'last_workout'],
    },
  ],

  // ========================================
  // COGNITIVE PERFORMANCE
  // ========================================
  cognitive: [
    {
      domain: 'cognitive',
      topic: 'deep_work_timing',
      principle: 'Peak cognitive performance occurs 2-4 hours post-wake when cortisol and dopamine are elevated.',
      timingRules: [
        'Schedule deep work: 2-4 hours post-wake',
        'Block distractions during this window',
        'Avoid meetings during peak cognitive hours',
      ],
      contraindications: [
        'Poor sleep reduces peak performance window',
      ],
      contextFactors: ['wake_time', 'sleep_quality', 'task_difficulty'],
    },
    {
      domain: 'cognitive',
      topic: 'ultradian_rhythm',
      principle: 'Body operates in 90-minute cycles. Focus peaks then dips. Honor these cycles rather than forcing continuous work.',
      timingRules: [
        'Work in 90-min blocks',
        'Take 10-15 min break between blocks',
        'Break: walk, hydrate, look at distance',
      ],
      contraindications: [
        'Pushing past 90 min reduces subsequent focus quality',
      ],
      contextFactors: ['task_type', 'energy_level'],
    },
  ],

  // ========================================
  // SLEEP OPTIMIZATION
  // ========================================
  sleep: [
    {
      domain: 'sleep',
      topic: 'temperature_regulation',
      principle: 'Core body temp must drop 2-3°F for sleep onset. Warm extremities facilitate core cooling.',
      timingRules: [
        'Room temp: 65-68°F',
        'Warm shower 90 min pre-sleep (causes post-shower cooling)',
        'Wear socks if cold extremities',
      ],
      contraindications: [
        'Hot room prevents deep sleep',
      ],
      contextFactors: ['sleep_time', 'room_temperature'],
    },
    {
      domain: 'sleep',
      topic: 'screen_exposure',
      principle: 'Blue light (400-490nm) suppresses melatonin. Effect is dose-dependent and peaks 1-2 hours post-exposure.',
      timingRules: [
        'No screens 60 min before sleep',
        'Use blue blockers after sunset if necessary',
        'Dim all lights after 8 PM',
      ],
      contraindications: [
        'Screen time within 1 hour delays sleep by 30-60 min',
      ],
      contextFactors: ['sleep_time', 'screen_usage'],
    },
  ],

  // ========================================
  // BEHAVIORAL ADHERENCE
  // ========================================
  adherence: [
    {
      domain: 'adherence',
      topic: 'momentum_protection',
      principle: 'Momentum is more valuable than perfection. One missed action is not failure - protect the next action.',
      timingRules: [
        'After disruption: execute next scheduled action',
        'Do not try to "make up" for missed meals/workouts',
        'Reset is return to structure, not punishment',
      ],
      contraindications: [
        'Chasing perfection creates stress and breaks momentum',
      ],
      contextFactors: ['adherence_streak', 'stress_level'],
    },
    {
      domain: 'adherence',
      topic: 'containment_strategy',
      principle: 'If structure breaks, contain the damage. Do not let one disruption cascade into day-long derailment.',
      timingRules: [
        'Identify disruption point',
        'Execute next scheduled action on time',
        'Do not skip subsequent structure to compensate',
      ],
      contraindications: [
        'All-or-nothing thinking destroys long-term consistency',
      ],
      contextFactors: ['current_plan', 'last_action'],
    },
  ],
};

/**
 * Get relevant knowledge entries based on query context
 */
export function getRelevantKnowledge(
  domains: KnowledgeDomain[],
  contextFactors: string[]
): KnowledgeEntry[] {
  const entries: KnowledgeEntry[] = [];
  
  domains.forEach(domain => {
    const domainEntries = KNOWLEDGE_BASE[domain] || [];
    
    // Find entries matching context factors
    const relevant = domainEntries.filter(entry => 
      entry.contextFactors.some(factor => contextFactors.includes(factor))
    );
    
    // If no exact match, include all domain entries
    if (relevant.length > 0) {
      entries.push(...relevant);
    } else {
      entries.push(...domainEntries);
    }
  });
  
  return entries;
}
