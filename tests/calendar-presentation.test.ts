import test from "node:test";
import assert from "node:assert/strict";
import { calendarDayLabel, calendarLocation, sampleDeparture, uniqueInvitees } from "../src/calendar-presentation";

test("invitee names deduplicate across addresses and casing without losing conflicting responses", () => {
  assert.deepEqual(uniqueInvitees([
    { name: " Alex  Morgan ", address: "one@example.com", participationStatus: "ACCEPTED" },
    { name: "alex morgan", address: "two@example.com" },
    { name: "ALEX MORGAN", address: "three@example.com", participationStatus: "DECLINED" },
    { address: "other@example.com" },
  ]), [{ name: "Alex Morgan", statuses: ["ACCEPTED", "DECLINED"] }, { name: "other@example.com", statuses: [] }]);
});

test("local addresses keep street and suite; other cities keep city, postal state and ZIP without country", () => {
  assert.deepEqual(calendarLocation("2901 E Sahara Ave\nLas Vegas NV 89104\nUnited States", "Las Vegas", "NV"), { text: "2901 E Sahara Ave", isAddress: true });
  assert.equal(calendarLocation("123 Main St, Suite 204, Las Vegas, Nevada 89104, USA", "Las Vegas", "NV").text, "123 Main St\nSuite 204");
  assert.equal(calendarLocation("123 Main St, Henderson, Nevada 89014, United States", "Las Vegas", "NV").text, "123 Main St\nHenderson, NV 89014");
  assert.equal(calendarLocation("123 Main St\nLas Vegas NM 87701\nUnited States", "Las Vegas", "NV").text, "123 Main St\nLas Vegas, NM 87701");
  assert.equal(calendarLocation("2901 E Sahara Ave Las Vegas NV 89104 United States", "Las Vegas", "NV").text, "2901 E Sahara Ave");
  assert.deepEqual(calendarLocation("Video call", "Las Vegas", "NV"), { text: "Video call", isAddress: false });
});

test("sample departures support Pacific timestamps, clock-only fixtures, midnight and all-day events", () => {
  const event = { id: "a", title: "Dinner", calendar: "Personal", time: "7:00 PM" };
  assert.equal(sampleDeparture(event, 20), "6:40 PM");
  assert.equal(sampleDeparture({ ...event, startsAt: "2026-11-06T03:00:00Z" }, 30), "6:30 PM");
  assert.equal(sampleDeparture({ ...event, startsAt: "2026-11-05T08:10:00Z" }, 20), "Nov 4, 11:50 PM");
  assert.equal(sampleDeparture({ ...event, time: "00:10" }, 20), "11:50 PM (prev. day)");
  assert.equal(sampleDeparture({ ...event, allDay: true }, 20), undefined);
  assert.equal(sampleDeparture({ ...event, ongoing: true }, 20), undefined);
  assert.equal(sampleDeparture({ ...event, time: "TBD" }, 20), undefined);
});

test("calendar day labels distinguish today, tomorrow and later dates over year rollover", () => {
  assert.equal(calendarDayLabel("2026-12-31", "2026-12-31"), "Today · Thu, Dec 31");
  assert.equal(calendarDayLabel("2027-01-01", "2026-12-31"), "Tomorrow · Fri, Jan 1");
  assert.equal(calendarDayLabel("2027-01-04", "2026-12-31"), "Mon, Jan 4");
});
