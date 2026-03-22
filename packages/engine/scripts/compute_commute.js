// Quick computation script: commute start/end for work start 06:45 and 30min commute
const dateISO = '2026-03-17'; // test date

function parseTimeOnDate(timeStr, date) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const result = new Date(date);
  result.setHours(hours, minutes, 0, 0);
  return result;
}

function localDateToTimelineISO(date, dateISO) {
  const hour24 = date.getHours();
  const minute = date.getMinutes();
  const year = new Date(dateISO).getFullYear();
  const month = new Date(dateISO).getMonth() + 1;
  const day = new Date(dateISO).getDate();
  const local = new Date(year, month - 1, day, hour24, minute, 0, 0);
  return local.toISOString();
}

const workStartStr = '06:45';
const commuteMinutes = 30;

const workStart = parseTimeOnDate(workStartStr, new Date(dateISO));
const commuteStart = new Date(workStart.getTime() - commuteMinutes * 60000);
const commuteEnd = workStart;

console.log('Test date:', dateISO);
console.log('Work start (local):', workStart.toString());
console.log('Commute start (local):', commuteStart.toString());
console.log('Commute ISO start:', localDateToTimelineISO(commuteStart, dateISO));
console.log('Commute ISO end  :', localDateToTimelineISO(commuteEnd, dateISO));
