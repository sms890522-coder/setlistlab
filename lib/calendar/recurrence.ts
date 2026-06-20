export type RecurrenceType = "none" | "weekly" | "biweekly" | "monthly_same_date" | "monthly_nth_weekday";

export type RecurringDateInput = {
  startDate: string;
  recurrenceType: RecurrenceType;
  endDate?: string;
  count?: number;
  maxCount?: number;
};

export type NthWeekday = {
  weekday: number;
  nth: number | "last";
};

export function generateRecurringDates(input: RecurringDateInput) {
  const maxCount = Math.max(1, input.maxCount ?? 60);
  const start = parseDate(input.startDate);
  if (!start) return [];

  if (input.recurrenceType === "none") {
    return [formatDate(start)];
  }

  const end = input.endDate ? parseDate(input.endDate) : null;
  const requestedCount = input.count && input.count > 0 ? Math.floor(input.count) : undefined;
  const nthWeekday = getNthWeekdayOfMonth(input.startDate);
  const startDay = start.getDate();
  const dates: string[] = [];

  for (let index = 0; index < maxCount; index += 1) {
    if (requestedCount !== undefined && index >= requestedCount) break;

    const nextDate = getRecurringDate(start, input.recurrenceType, index, startDay, nthWeekday);
    if (end && nextDate > end) break;

    dates.push(formatDate(nextDate));

    if (requestedCount === undefined && !end) break;
  }

  return dates;
}

export function getNthWeekdayOfMonth(dateInput: string | Date): NthWeekday {
  const date = typeof dateInput === "string" ? parseDate(dateInput) : cloneDate(dateInput);
  if (!date) {
    return { weekday: 0, nth: 1 };
  }

  const day = date.getDate();
  const weekday = date.getDay();
  const nth = Math.floor((day - 1) / 7) + 1;
  const nextSameWeekday = day + 7;
  const lastDay = getLastDayOfMonth(date.getFullYear(), date.getMonth() + 1);

  return {
    weekday,
    nth: nextSameWeekday > lastDay ? "last" : nth,
  };
}

export function getDateForNthWeekday(year: number, month: number, weekday: number, nth: number | "last") {
  const lastDay = getLastDayOfMonth(year, month);

  if (nth === "last") {
    for (let day = lastDay; day >= 1; day -= 1) {
      const date = createDate(year, month, day);
      if (date.getDay() === weekday) return date;
    }
  }

  const firstDay = createDate(year, month, 1);
  const offset = (weekday - firstDay.getDay() + 7) % 7;
  const targetDay = 1 + offset + ((Number(nth) || 1) - 1) * 7;
  return createDate(year, month, Math.min(targetDay, lastDay));
}

export function clampToLastDayOfMonth(year: number, month: number, day: number) {
  return Math.min(day, getLastDayOfMonth(year, month));
}

function getRecurringDate(
  start: Date,
  recurrenceType: RecurrenceType,
  index: number,
  startDay: number,
  nthWeekday: NthWeekday,
) {
  if (recurrenceType === "weekly") {
    return addDays(start, index * 7);
  }

  if (recurrenceType === "biweekly") {
    return addDays(start, index * 14);
  }

  const { year, month } = addMonthsParts(start, index);

  if (recurrenceType === "monthly_same_date") {
    return createDate(year, month, clampToLastDayOfMonth(year, month, startDay));
  }

  return getDateForNthWeekday(year, month, nthWeekday.weekday, nthWeekday.nth);
}

function parseDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = createDate(year, month, day);

  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }

  return date;
}

function addDays(date: Date, days: number) {
  return createDate(date.getFullYear(), date.getMonth() + 1, date.getDate() + days);
}

function addMonthsParts(date: Date, months: number) {
  const next = createDate(date.getFullYear(), date.getMonth() + 1 + months, 1);
  return {
    year: next.getFullYear(),
    month: next.getMonth() + 1,
  };
}

function getLastDayOfMonth(year: number, month: number) {
  return createDate(year, month + 1, 0).getDate();
}

function createDate(year: number, month: number, day: number) {
  return new Date(year, month - 1, day);
}

function cloneDate(date: Date) {
  return createDate(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

function formatDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
