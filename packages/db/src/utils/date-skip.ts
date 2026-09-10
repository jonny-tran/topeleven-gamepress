/**
 * Returns the Nth weekday (Mon-Fri) after a given date.
 * Skips Saturday (day 6) and Sunday (day 0).
 */
export function nextWeekday(fromDate: Date, count: number): Date {
  let date = new Date(fromDate);
  let added = 0;
  while (added < count) {
    date.setDate(date.getDate() + 1);
    const day = date.getDay();
    if (day !== 0 && day !== 6) {
      added++;
    }
  }
  return date;
}

/**
 * Returns the Nth weekday that falls on a weekend (Sat/Sun).
 * Starts searching from the day after fromDate.
 */
export function nextWeekendDay(fromDate: Date, count: number): Date {
  let date = new Date(fromDate);
  let added = 0;
  while (added < count) {
    date.setDate(date.getDate() + 1);
    const day = date.getDay();
    if (day === 0 || day === 6) {
      added++;
    }
  }
  return date;
}

/**
 * Checks if a date falls on a weekend.
 */
export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}
