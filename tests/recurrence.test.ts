import assert from "node:assert/strict";
import test from "node:test";
import {
  clampToLastDayOfMonth,
  generateRecurringDates,
  getDateForNthWeekday,
  getNthWeekdayOfMonth,
} from "../lib/calendar/recurrence.ts";

test("generateRecurringDates creates weekly and biweekly dates", () => {
  assert.deepEqual(
    generateRecurringDates({ startDate: "2026-06-21", recurrenceType: "weekly", count: 4 }),
    ["2026-06-21", "2026-06-28", "2026-07-05", "2026-07-12"],
  );
  assert.deepEqual(
    generateRecurringDates({ startDate: "2026-06-21", recurrenceType: "biweekly", count: 3 }),
    ["2026-06-21", "2026-07-05", "2026-07-19"],
  );
});

test("monthly_same_date clamps missing days to month end", () => {
  assert.equal(clampToLastDayOfMonth(2026, 2, 31), 28);
  assert.deepEqual(
    generateRecurringDates({ startDate: "2026-01-31", recurrenceType: "monthly_same_date", count: 3 }),
    ["2026-01-31", "2026-02-28", "2026-03-31"],
  );
});

test("monthly_nth_weekday follows the same weekday order", () => {
  assert.deepEqual(getNthWeekdayOfMonth("2026-06-21"), { weekday: 0, nth: 3 });
  assert.equal(formatDate(getDateForNthWeekday(2026, 7, 0, 3)), "2026-07-19");
  assert.deepEqual(
    generateRecurringDates({ startDate: "2026-06-21", recurrenceType: "monthly_nth_weekday", count: 3 }),
    ["2026-06-21", "2026-07-19", "2026-08-16"],
  );
});

test("generateRecurringDates respects end date and max count", () => {
  assert.deepEqual(
    generateRecurringDates({ startDate: "2026-06-21", recurrenceType: "weekly", endDate: "2026-07-05" }),
    ["2026-06-21", "2026-06-28", "2026-07-05"],
  );
  assert.equal(generateRecurringDates({ startDate: "2026-06-21", recurrenceType: "weekly", count: 99 }).length, 60);
});

function formatDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
