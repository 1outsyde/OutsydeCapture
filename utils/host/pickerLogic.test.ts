/** Unit tests for the app's own date and time pickers (Events canvas 32, no native picker package). npx tsx utils/host/pickerLogic.test.ts */
import { monthGrid, shiftMonth, dateLabel, timeLabel, timeOptions, monthTitle, monthOf, todayIn } from "./pickerLogic";

let passed = 0, failed = 0;
function eq(actual: unknown, expected: unknown, name: string) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { passed++; console.log(`  ok  ${name}`); } else { failed++; console.error(`  FAIL ${name}`, JSON.stringify(actual), "expected", JSON.stringify(expected)); }
}

console.log("monthGrid");
const oct = monthGrid(2026, 10);
eq(oct.length % 7, 0, "whole weeks");
eq(oct.slice(0, 5), [null, null, null, null, "2026-10-01"], "Oct 1 2026 is a Thursday");
eq(oct.filter(Boolean).length, 31, "31 days");
eq(oct[oct.indexOf("2026-10-31")] , "2026-10-31", "has Oct 31");
eq(oct.indexOf("2026-10-31") % 7, 6, "Oct 31 2026 is a Saturday");
eq(monthGrid(2026, 2).filter(Boolean).length, 28, "Feb 2026 has 28 days");
eq(monthGrid(2028, 2).filter(Boolean).length, 29, "Feb 2028 is a leap month");
eq(monthGrid(2026, 11)[0], "2026-11-01", "Nov 1 2026 is a Sunday: no blanks");

console.log("shiftMonth and titles");
eq(shiftMonth({ y: 2026, m: 12 }, 1), { y: 2027, m: 1 }, "December to January");
eq(shiftMonth({ y: 2026, m: 1 }, -1), { y: 2025, m: 12 }, "January back to December");
eq(monthTitle({ y: 2026, m: 10 }), "October 2026", "month title");
eq(monthOf("2026-10-31"), { y: 2026, m: 10 }, "month of a date");
eq(monthOf(""), null, "no date");

console.log("labels");
eq(dateLabel("2026-10-31", 2026), "Sat, Oct 31", "date label");
eq(dateLabel("2027-01-01", 2026), "Fri, Jan 1, 2027", "another year shows the year");
eq(dateLabel("2026-10-31", 2027), "Sat, Oct 31, 2026", "year shown when it isn't this year");
eq(dateLabel(""), "Pick a date", "empty date");
eq(timeLabel("21:00"), "9:00 PM", "evening");
eq(timeLabel("00:30"), "12:30 AM", "after midnight");
eq(timeLabel("12:00"), "12:00 PM", "noon");
eq(timeLabel(""), "Pick a time", "empty time");

console.log("timeOptions");
const t = timeOptions(15);
eq(t.length, 96, "every 15 minutes");
eq(t[0], "00:00", "starts at midnight");
eq(t[t.length - 1], "23:45", "ends at 11:45 PM");
eq(timeOptions(15, "21:07").includes("21:07"), true, "a saved odd time stays pickable");
eq(timeOptions(15, "21:07").indexOf("21:07"), timeOptions(15, "21:07").indexOf("21:00") + 1, "in order");

console.log("todayIn");
eq(todayIn("America/New_York", new Date("2026-10-27T02:00:00Z")), "2026-10-26", "evening in New York is still the 26th");
eq(todayIn("Pacific/Honolulu", new Date("2026-10-27T09:00:00Z")), "2026-10-26", "Honolulu");

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
