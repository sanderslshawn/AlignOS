export interface GlossaryEntry {
  term: string;
  definition: string;
}

export const GLOSSARY: GlossaryEntry[] = [
  { term: 'Plan vs Actual', definition: 'Comparison between scheduled intentions and what happened in reality, used to keep the day adaptive without full reset.' },
  { term: 'Reality Mode', definition: 'A timeline layer that marks items as planned, actual, skipped, or auto-adjusted so the system can adapt quickly.' },
  { term: 'Momentum Protection', definition: 'A lightweight safeguard that detects wobble/collapse risk and proposes a micro-reset to keep the day on track.' },
  { term: 'Fasting Window', definition: 'Planned hours between last meal and first meal the next day.' },
  { term: 'Activation Routine', definition: 'A short routine to raise alertness and readiness before key work blocks.' },
  { term: 'Treat Containment', definition: 'Scheduling treats inside a controlled window to avoid all-day spillover.' },
  { term: 'Recovery Day', definition: 'Lower-intensity day favoring sleep quality, stress reduction, and easier movement.' },
  { term: 'Day Mode', definition: 'Strategy profile (tight, flex, recovery, etc.) that controls schedule structure.' },
  { term: 'Circadian Rhythm', definition: 'Daily biological timing pattern influencing sleep, energy, and performance.' },
  { term: 'Winddown', definition: 'Pre-sleep routine that reduces stimulation and supports better sleep onset.' },
  { term: 'Meal Anchors', definition: 'Core meal timing points used to stabilize energy and reduce reactive eating decisions.' },
  { term: 'Recompute', definition: 'Recalculating the plan after edits/events so overlaps resolve and sequence remains coherent.' },
  { term: 'Schedule Insert', definition: 'A suggested activity block inserted directly from advisor/system actions.' },
  { term: 'Rhythm Learning', definition: 'Privacy-friendly aggregation of timing habits over recent days to improve future scheduling.' },
  { term: 'System Suggestion', definition: 'In-app actionable nudge triggered by dip windows, disruption patterns, or momentum signals.' },
];

export const FAQ: string[] = [
  'How do I edit schedule times? Tap a timeline item and use the time picker for start/end.',
  'How do I regenerate today? Use Regenerate on the Timeline control bar.',
  'How do I add advisor suggestions? Tap Add to Plan in the advisor response card.',
  'How do I undo an advisor insert? Tap Undo on the snackbar immediately after adding.',
  'Where is tomorrow look-ahead? Open Timeline and use Tomorrow Preview.',
  'How do I log something that already happened? Use the Log button on Timeline and set the past time.',
  'What does Momentum protection mean? The system detected risk and suggests small actions to prevent day collapse.',
];
