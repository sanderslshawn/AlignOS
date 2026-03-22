import { generateDayPlan } from '../src/generateDayPlan';

const profile = {
  wakeTime: '06:00',
  sleepTime: '22:00',
  workStartTime: '06:45',
  workEndTime: '15:00',
  commuteDuration: 30,
};

const dateISO = '2026-03-19';

const plan = generateDayPlan({ dateISO, settings: profile as any, todayEntries: [] });

const work = plan.items.find((i) => i.type === 'work');
const commuteEvening = plan.items.find((i) => i.id?.startsWith('commute-evening'));

console.log('work:', work);
console.log('commuteEvening:', commuteEvening);
console.log('all items:');
plan.items.forEach((it) => console.log(it.type, it.id, it.startISO, it.endISO));
