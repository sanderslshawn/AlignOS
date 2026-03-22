export interface GlossaryTerm {
  term: string;
  explanation: string;
  example?: string;
}

export const GLOSSARY_TERMS: GlossaryTerm[] = [
  {
    term: 'AlignOS',
    explanation: 'Your daily operating system for planning, adapting, and protecting energy through the day.',
    example: 'AlignOS turns your wake-to-sleep window into a practical timeline.',
  },
  {
    term: 'Anchors',
    explanation: 'Stable events that keep your day grounded, like wake, meals, and sleep.',
    example: 'If meetings move, anchors still protect your baseline rhythm.',
  },
  {
    term: 'Timeline',
    explanation: 'Your ordered day plan showing what to do now, next, and later.',
  },
  {
    term: 'Energy Forecast',
    explanation: 'A prediction of likely energy highs and dips based on schedule structure and signals.',
  },
  {
    term: 'Momentum Score',
    explanation: 'A simple score that reflects how stable and executable your day currently is.',
  },
  {
    term: 'Day Mode',
    explanation: 'The operating style for your day (for example: tight, flex, recovery).',
    example: 'Recovery mode reduces intensity and protects consistency.',
  },
  {
    term: 'Signals',
    explanation: 'Quick context inputs (like low energy or high stress) that trigger adaptive adjustments.',
  },
  {
    term: 'Suggested Insertions',
    explanation: 'Small recommended actions you can add to stabilize energy or momentum.',
    example: 'Insert an 8-minute walk after a low-energy signal.',
  },
  {
    term: 'Predictive Day',
    explanation: 'Tomorrow-facing forecast of likely focus windows, dips, and best opportunities.',
  },
  {
    term: 'Focus Window',
    explanation: 'The time block where deep work is most likely to be effective.',
  },
  {
    term: 'Energy Dip',
    explanation: 'A likely lower-energy period where lighter or restorative actions are more effective.',
  },
  {
    term: 'Recovery Block',
    explanation: 'A short low-intensity block used to reduce stress load and restore execution quality.',
  },
  {
    term: 'Circadian Rhythm',
    explanation: 'Your natural 24-hour biological timing pattern that influences alertness and sleep pressure.',
  },
  {
    term: 'Adaptive Timeline',
    explanation: 'A timeline that updates as your context changes, instead of forcing a rigid schedule.',
  },
  {
    term: 'Momentum Protection',
    explanation: 'System logic that prioritizes next-best actions to prevent a bad hour from becoming a bad day.',
  },
  {
    term: 'System Anchors',
    explanation: 'Core non-negotiable structures the planner uses to preserve day stability.',
  },
  {
    term: 'Context Signals',
    explanation: 'Inputs that describe current state (sleep, stress, hunger, fog) and adjust recommendations.',
  },
  {
    term: 'Recovery Windows',
    explanation: 'Times where lower cognitive load and light movement are favored for better overall output.',
  },
  {
    term: 'Movement Anchors',
    explanation: 'Scheduled walks or workouts that support energy regulation and consistency.',
  },
  {
    term: 'Recommendations',
    explanation: 'Actionable suggestions generated from your current plan, state, and signals.',
  },
];
