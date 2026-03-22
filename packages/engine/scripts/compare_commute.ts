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
const commute = plan.items.find((i) => i.id?.startsWith('commute-evening'));

if (!work || !commute) {
  console.log('missing work or commute');
  process.exit(1);
}

const workEndISO = work.endISO!;
const commuteStartISO = commute.startISO!;
const commuteEndISO = commute.endISO!;

const workEndDate = new Date(workEndISO);
const expectedCommuteEnd = new Date(workEndDate.getTime() + (30 * 60 * 1000));

console.log('workEndISO', workEndISO, '-> parsed local:', workEndDate.toString());
console.log('commuteStartISO', commuteStartISO, '-> parsed local:', new Date(commuteStartISO).toString());
console.log('commuteEndISO', commuteEndISO, '-> parsed local:', new Date(commuteEndISO).toString());
console.log('expectedCommuteEnd (workEnd + 30m):', expectedCommuteEnd.toISOString(), 'parsed local:', expectedCommuteEnd.toString());
