// Compute evening commute start/end for work end 15:00 and 30min commute
const dateISO = '2026-03-16'; // test date

function parseTimeOnDate(timeStr, date) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const result = new Date(date);
  result.setHours(hours, minutes, 0, 0);
  return result;
}

function toISOWithLocalClock(date, dateISO) {
  // create an ISO that preserves the local clock using UTC component construction
  const hour = date.getHours();
  const minute = date.getMinutes();
  const [yearStr, monthStr, dayStr] = dateISO.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  const utc = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  return new Date(utc).toISOString();
}

const workEndStr = '15:00';
const commuteMinutes = 30;

const workEnd = parseTimeOnDate(workEndStr, new Date(dateISO));
const commuteStart = workEnd; // commute start at work end? in generator eveningCommuteEnd = addMinutes(workEnd, commuteDuration)
const commuteEnd = new Date(workEnd.getTime() + commuteMinutes * 60000);

console.log('Test date:', dateISO);
console.log('Work end (local):', workEnd.toString());
console.log('Commute start (local):', commuteStart.toString());
console.log('Commute start ISO:', toISOWithLocalClock(commuteStart, dateISO));
console.log('Commute end (local):', commuteEnd.toString());
console.log('Commute end ISO  :', toISOWithLocalClock(commuteEnd, dateISO));
