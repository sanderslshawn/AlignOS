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

console.log('Plan items with ISO and parsed local time:');
plan.items.forEach((it) => {
  const startISO = it.startISO;
  const endISO = it.endISO;
  const startLocal = startISO ? new Date(startISO).toString() : 'n/a';
  const endLocal = endISO ? new Date(endISO).toString() : 'n/a';
  console.log(`${it.type} ${it.id} -> startISO=${startISO} parsed=${startLocal} | endISO=${endISO} parsed=${endLocal}`);
});
