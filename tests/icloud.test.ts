import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { once } from "node:events";
import { request as httpRequest } from "node:http";
import { appleUrl, calendarItems, dayBounds, ICloudConnection } from "../server/icloud";
import { createICloudRouter } from "../server/icloud-routes";
import { defaultConfig, normalizeConfig } from "../src/config";

const calendar = { id: "a".repeat(64), name: "Personal" };
const now = new Date("2026-11-05T18:00:00Z");
const ics = (...events: string[]) => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Receipt Summary Tests//EN\r\n${events.join("\r\n")}\r\nEND:VCALENDAR\r\n`;
const event = (uid: string, lines: string[]) => ["BEGIN:VEVENT", `UID:${uid}`, "DTSTAMP:20260101T000000Z", ...lines, "END:VEVENT"].join("\r\n");
const xml = (responses: string) => `<?xml version="1.0"?><d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">${responses}</d:multistatus>`;
const dav = (href: string, prop: string) => `<d:response><d:href>${href}</d:href><d:propstat><d:prop>${prop}</d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>`;

test("Pacific local-day boundaries include 23-hour and 25-hour DST days", () => {
  const spring = dayBounds(new Date("2026-03-08T18:00:00Z"));
  assert.equal(spring.date, "2026-03-08");
  assert.equal(spring.start.toISOString(), "2026-03-08T08:00:00.000Z");
  assert.equal(spring.end.valueOf() - spring.start.valueOf(), 23 * 3600000);
  const autumn = dayBounds(new Date("2026-11-01T18:00:00Z"));
  assert.equal(autumn.end.valueOf() - autumn.start.valueOf(), 25 * 3600000);
});

test("Calendar parsing preserves Pacific dates, overnight events, recurrence overrides and exclusions", async () => {
  const data = ics(
    event("daily", ["DTSTART;TZID=America/Los_Angeles:20261030T090000", "DTEND;TZID=America/Los_Angeles:20261030T100000", "RRULE:FREQ=DAILY;COUNT=10", "SUMMARY:Daily meeting"]),
    event("daily", ["RECURRENCE-ID;TZID=America/Los_Angeles:20261105T090000", "DTSTART;TZID=America/Los_Angeles:20261105T110000", "DTEND;TZID=America/Los_Angeles:20261105T113000", "SUMMARY:Rescheduled", "LOCATION:Office"]),
    event("excluded", ["DTSTART;TZID=America/Los_Angeles:20261101T120000", "RRULE:FREQ=DAILY;COUNT=10", "EXDATE;TZID=America/Los_Angeles:20261105T120000", "SUMMARY:Excluded"]),
    event("cancelled", ["DTSTART:20261105T200000Z", "STATUS:CANCELLED", "SUMMARY:Cancelled"]),
    event("overnight", ["DTSTART:20261105T070000Z", "DTEND:20261105T090000Z", "SUMMARY:Overnight"]),
    event("tomorrow", ["DTSTART:20261106T080000Z", "SUMMARY:Tomorrow"]),
    event("floating", ["DTSTART:20261105T143000", "DTEND:20261105T150000", "SUMMARY:Floating"]),
    event("all-day", ["DTSTART;VALUE=DATE:20261105", "DTEND;VALUE=DATE:20261106", "SUMMARY:Day off"]),
    event("ended", ["DTSTART;VALUE=DATE:20261104", "DTEND;VALUE=DATE:20261105", "SUMMARY:Ended yesterday"]),
    event("multi", ["DTSTART;VALUE=DATE:20261103", "DTEND;VALUE=DATE:20261107", "SUMMARY:Multi-day"]),
  );
  const items = await calendarItems(data, calendar, now);
  assert.deepEqual(items.map(i => i.title).sort(), ["Rescheduled", "Overnight", "Floating", "Day off", "Multi-day"].sort());
  assert.equal(items.find(i => i.title === "Rescheduled")?.time, "11:00 AM");
  assert.equal(items.find(i => i.title === "Rescheduled")?.location, "Office");
  assert.equal(items.find(i => i.title === "Floating")?.time, "2:30 PM");
  assert.equal(items.find(i => i.title === "Day off")?.allDay, true);
  const nextDay = await calendarItems(data, calendar, new Date("2026-11-06T18:00:00Z"));
  assert.equal(nextDay.find(i => i.title === "Daily meeting")?.time, "9:00 AM");
  const cancelled = await calendarItems(ics(
    event("rec", ["DTSTART:20261104T170000Z", "RRULE:FREQ=DAILY;COUNT=3", "SUMMARY:Recurring"]),
    event("rec", ["RECURRENCE-ID:20261105T170000Z", "DTSTART:20261105T170000Z", "STATUS:CANCELLED", "SUMMARY:Cancelled instance"]),
  ), calendar, now);
  assert.deepEqual(cancelled, []);
});

test("five-day window includes the whole fourth future Pacific day across DST and year changes", async () => {
  for (const scenario of [
    { now: "2026-11-05T18:00:00Z", fourth: "2026-11-09", last: "2026-11-10T07:59:59Z", end: "2026-11-10T08:00:00Z", hours: 120 },
    { now: "2026-10-30T18:00:00Z", fourth: "2026-11-03", last: "2026-11-04T07:59:59Z", end: "2026-11-04T08:00:00Z", hours: 121 },
    { now: "2026-03-06T18:00:00Z", fourth: "2026-03-10", last: "2026-03-11T06:59:59Z", end: "2026-03-11T07:00:00Z", hours: 119 },
    { now: "2026-12-30T18:00:00Z", fourth: "2027-01-03", last: "2027-01-04T07:59:59Z", end: "2027-01-04T08:00:00Z", hours: 120 },
  ]) {
    const clock = new Date(scenario.now), window = dayBounds(clock, 5);
    assert.equal(window.throughDate, scenario.fourth);
    assert.equal(window.end.toISOString(), new Date(scenario.end).toISOString());
    assert.equal((window.end.valueOf() - window.start.valueOf()) / 3600000, scenario.hours);
    const davTime = (value: string) => value.replace(/[-:]/g, "");
    const items = await calendarItems(ics(
      event("fourth", [`DTSTART:${davTime(scenario.last)}`, "SUMMARY:Last minute"]),
      event("outside", [`DTSTART:${davTime(scenario.end)}`, "SUMMARY:Fifth day"]),
      event("all-day", [`DTSTART;VALUE=DATE:${scenario.fourth.replace(/-/g, "")}`, "SUMMARY:Fourth all day"]),
    ), calendar, clock, 5);
    assert.deepEqual(items.map(item => item.title).sort(), ["Fourth all day", "Last minute"]);
    assert.ok(items.every(item => item.date === scenario.fourth));
  }
});

test("five-day expansion preserves future overrides/exclusions and emits ongoing multi-day events once", async () => {
  const items = await calendarItems(ics(
    event("daily", ["DTSTART:20261105T170000Z", "RRULE:FREQ=DAILY;COUNT=6", "EXDATE:20261107T170000Z", "SUMMARY:Daily"]),
    event("daily", ["RECURRENCE-ID:20261106T170000Z", "DTSTART:20261106T190000Z", "SUMMARY:Moved"]),
    event("daily", ["RECURRENCE-ID:20261108T170000Z", "DTSTART:20261108T170000Z", "STATUS:CANCELLED"]),
    event("ongoing", ["DTSTART;VALUE=DATE:20261103", "DTEND;VALUE=DATE:20261108", "SUMMARY:Trip"]),
  ), calendar, now, 5);
  assert.deepEqual(items.filter(item => item.title === "Daily").map(item => item.date), ["2026-11-05", "2026-11-09"]);
  assert.equal(items.find(item => item.title === "Moved")?.date, "2026-11-06");
  assert.equal(items.find(item => item.title === "Moved")?.time, "11:00 AM");
  const ongoing = items.filter(item => item.title === "Trip");
  assert.equal(ongoing.length, 1);
  assert.equal(ongoing[0].date, "2026-11-05");
  assert.equal(ongoing[0].ongoing, true);
});

test("descriptions retain decoded text and follow recurrence overrides without losing inherited notes", async () => {
  const data = ics(
    event("notes", ["DTSTART:20261104T170000Z", "RRULE:FREQ=DAILY;COUNT=4", "SUMMARY:Recurring", "DESCRIPTION;LANGUAGE=en:  Bring ID\\nUse east entrance\\, not west\\; arrive early.  "]),
    event("notes", ["RECURRENCE-ID:20261105T170000Z", "DTSTART:20261105T180000Z", "SUMMARY:Changed", "DESCRIPTION:Use south entrance instead."]),
    event("notes", ["RECURRENCE-ID:20261106T170000Z", "DTSTART:20261106T180000Z", "SUMMARY:Inherited"]),
    event("empty", ["DTSTART:20261105T200000Z", "SUMMARY:No notes"]),
  );
  const today = await calendarItems(data, calendar, now);
  assert.equal(today.find(item => item.title === "Changed")?.description, "Use south entrance instead.");
  assert.equal(today.find(item => item.title === "No notes")?.description, undefined);
  const tomorrow = await calendarItems(data, calendar, new Date("2026-11-06T18:00:00Z"));
  assert.equal(tomorrow.find(item => item.title === "Inherited")?.description, "  Bring ID\nUse east entrance, not west; arrive early.  ");
  const normal = await calendarItems(data, calendar, new Date("2026-11-07T18:00:00Z"));
  assert.equal(normal[0].description, "  Bring ID\nUse east entrance, not west; arrive early.  ");
});

test("invitees retain names, email fallbacks and response status across recurrence overrides", async () => {
  const data = ics(
    event("people", [
      "DTSTART:20261104T170000Z", "RRULE:FREQ=DAILY;COUNT=4", "SUMMARY:Team review", "LOCATION:Main office",
      'ATTENDEE;CN="River, Lee";PARTSTAT=ACCEPTED:mailto:river@example.com',
      "ATTENDEE;PARTSTAT=TENTATIVE:MAILTO:pending@example.com",
      "ATTENDEE;CN=Sam;PARTSTAT=DECLINED:mailto:sam@example.com",
      "ATTENDEE:mailto:unknown@example.com",
    ]),
    event("people", ["RECURRENCE-ID:20261105T170000Z", "DTSTART:20261105T180000Z", "SUMMARY:Changed", "LOCATION:Annex", "ATTENDEE;CN=Casey;PARTSTAT=NEEDS-ACTION:mailto:casey@example.com"]),
    event("people", ["RECURRENCE-ID:20261106T170000Z", "DTSTART:20261106T180000Z", "SUMMARY:Inherited"]),
    event("none", ["DTSTART:20261105T200000Z", "SUMMARY:Solo"]),
  );
  const today = await calendarItems(data, calendar, now);
  const changed = today.find(item => item.title === "Changed")!;
  assert.equal(changed.location, "Annex");
  assert.deepEqual(changed.invitees, [{ name: "Casey", address: "casey@example.com", participationStatus: "NEEDS-ACTION" }]);
  assert.deepEqual(today.find(item => item.title === "Solo")?.invitees, []);
  const tomorrow = await calendarItems(data, calendar, new Date("2026-11-06T18:00:00Z"));
  const inherited = tomorrow.find(item => item.title === "Inherited")!;
  assert.equal(inherited.location, "Main office");
  assert.deepEqual(inherited.invitees, [
    { name: "River, Lee", address: "river@example.com", participationStatus: "ACCEPTED" },
    { name: undefined, address: "pending@example.com", participationStatus: "TENTATIVE" },
    { name: "Sam", address: "sam@example.com", participationStatus: "DECLINED" },
    { name: undefined, address: "unknown@example.com", participationStatus: undefined },
  ]);
  const normal = await calendarItems(data, calendar, new Date("2026-11-07T18:00:00Z"));
  assert.deepEqual(normal[0].invitees, inherited.invitees);
});

test("read-only discovery follows Apple shards, distinguishes same-name calendars and reads only selected IDs", async () => {
  const requests: { url: string; method: string; body: string }[] = [];
  const responses = [
    new Response(null, { status: 301, headers: { location: "https://p12-caldav.icloud.com/" } }),
    new Response(xml(dav("/", "<d:current-user-principal><d:href>/123/principal/</d:href></d:current-user-principal>")), { status: 207 }),
    new Response(xml(dav("/123/principal/", "<c:calendar-home-set><d:href>/123/calendars/</d:href></c:calendar-home-set>")), { status: 207 }),
    new Response(xml(dav("/123/calendars/a/", '<d:displayname>Personal &amp; Home</d:displayname><d:resourcetype><d:collection/><c:calendar/></d:resourcetype><c:supported-calendar-component-set><c:comp name="VEVENT"/></c:supported-calendar-component-set>') + dav("/123/calendars/b/", '<d:displayname>Personal &amp; Home</d:displayname><d:resourcetype><c:calendar/></d:resourcetype>') + dav("/123/calendars/tasks/", '<d:displayname>Tasks</d:displayname><d:resourcetype><c:calendar/></d:resourcetype><c:supported-calendar-component-set><c:comp name="VTODO"/></c:supported-calendar-component-set>')), { status: 207 }),
    new Response(xml(dav("/123/calendars/a/test.ics", `<c:calendar-data><![CDATA[${ics(
      event("future-all-day", ["DTSTART;VALUE=DATE:20261106", "SUMMARY:Future all day"]),
      event("live", ["DTSTART:20261105T170000Z", "SUMMARY:Live test"]),
      event("fourth", ["DTSTART:20261110T070000Z", "SUMMARY:Fourth day"]),
      event("outside", ["DTSTART:20261110T080000Z", "SUMMARY:Outside"]),
    )}]]></c:calendar-data>`)), { status: 207 }),
  ];
  const connection = new ICloudConnection("example@icloud.com", "aaaa-bbbb-cccc-dddd", async (url, options) => {
    requests.push({ url: String(url), method: options!.method!, body: String(options!.body) });
    assert.match(new Headers(options!.headers).get("Authorization")!, /^Basic /);
    return responses.shift()!;
  });
  const status = await connection.discover();
  assert.equal(status.calendars.length, 2);
  assert.equal(status.calendars[0].name, "Personal & Home");
  assert.notEqual(status.calendars[0].id, status.calendars[1].id);
  assert.doesNotMatch(JSON.stringify(status), /aaaa|password|authorization|123\/calendars/i);
  const data = await connection.upcoming([status.calendars[0].id], now);
  assert.equal(data.items[0].time, "9:00 AM");
  assert.equal(data.date, "2026-11-05");
  assert.equal(data.throughDate, "2026-11-09");
  assert.deepEqual(data.items.map(item => item.title), ["Live test", "Future all day", "Fourth day"]);
  assert.deepEqual(data.items.map(item => item.date), ["2026-11-05", "2026-11-06", "2026-11-09"]);
  assert.equal(requests.at(-1)?.url, "https://p12-caldav.icloud.com/123/calendars/a/");
  assert.ok(requests.every(r => ["PROPFIND", "REPORT"].includes(r.method)));
  assert.match(requests.at(-1)!.body, /<c:time-range/);
  assert.match(requests.at(-1)!.body, /end="20261111T080000Z"/);
  await assert.rejects(connection.upcoming(["not-a-discovered-calendar"], now), /no longer available/);
});

test("credentials never follow non-Apple redirects; auth and malformed responses fail clearly", async () => {
  for (const url of ["https://evil.test/", "http://caldav.icloud.com/", "https://caldav.icloud.com.evil.test/", "https://x@caldav.icloud.com/"]) assert.throws(() => appleUrl(url));
  let calls = 0;
  const connection = new ICloudConnection("example@icloud.com", "secret", async () => { calls++; return new Response(null, { status: 302, headers: { location: "https://evil.test/" } }); });
  await assert.rejects(connection.discover(), /unexpected calendar server/);
  assert.equal(calls, 1);
  await assert.rejects(new ICloudConnection("a", "b", async () => new Response(null, { status: 401 })).discover(), /Apple rejected/);
  await assert.rejects(new ICloudConnection("a", "b", async () => new Response("not xml", { status: 207 })).discover(), /invalid calendar data/);
  await assert.rejects(calendarItems("broken", calendar, now), /incomplete event data/);
});

test("local API rejects cross-site access, clears sessions and sanitizes credential errors", async () => {
  const app = express();
  let connectCount = 0;
  app.use("/api/icloud", createICloudRouter(() => {
    connectCount++;
    return { discover: async () => ({ connected: true, calendars: [calendar] }), status: () => ({ connected: true, calendars: [calendar] }), upcoming: async () => { throw new Error("PRIVATE EVENT OR PASSWORD"); } } as unknown as ICloudConnection;
  }));
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const root = `http://127.0.0.1:${address.port}/api/icloud`;
  try {
    const request = (route: string, body: unknown, headers = {}) => fetch(`${root}/${route}`, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
    assert.equal((await request("connect", {}, { Origin: "https://evil.test" })).status, 403);
    const badHostStatus = await new Promise<number | undefined>((resolve, reject) => {
      const req = httpRequest(`${root}/status`, { headers: { Host: "evil.test" } }, response => { response.resume(); resolve(response.statusCode); });
      req.on("error", reject); req.end();
    });
    assert.equal(badHostStatus, 403);
    assert.equal((await request("connect", {}, { "Sec-Fetch-Site": "cross-site" })).status, 403);
    assert.equal((await request("connect", { email: "example@icloud.com", password: "normal-password" })).status, 400);
    assert.equal(connectCount, 0);
    assert.equal((await request("connect", { email: "example@icloud.com", password: "aaaa-bbbb-cccc-dddd" })).status, 200);
    const failed = await request("events", { calendarIds: [calendar.id] });
    assert.equal(failed.status, 502);
    assert.equal(failed.headers.get("cache-control"), "no-store");
    assert.doesNotMatch(await failed.text(), /PRIVATE|PASSWORD/);
    await request("disconnect", {});
    assert.deepEqual(await (await fetch(`${root}/status`)).json(), { connected: false, calendars: [] });
    assert.equal((await request("events", { calendarIds: [] })).status, 401);
    const malformed = await fetch(`${root}/connect`, { method: "POST", headers: { "Content-Type": "application/json" }, body: '{"password":"PRIVATE"' });
    assert.equal(malformed.status, 400);
    assert.doesNotMatch(await malformed.text(), /PRIVATE/);
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
});

test("saved configuration migrates old settings without credentials", () => {
  const old = structuredClone(defaultConfig) as any;
  delete old.sources.calendarMode;
  delete old.sources.calendarIds;
  old.sources.password = "PRIVATE";
  const config = normalizeConfig(old);
  assert.equal(config.sources.calendarMode, "sample");
  assert.deepEqual(config.sources.calendarIds, []);
  assert.doesNotMatch(JSON.stringify(config), /PRIVATE|password/);
});
