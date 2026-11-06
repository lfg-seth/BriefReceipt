// Opt-in, paid model evaluation against the running local app, using fictional
// inputs only. Going through the server preserves its shared cache and budget.
const root = "http://localhost:5173/api/ai";
const status = await fetch(`${root}/status`).then(response => response.json());
if (!status.connected) throw new Error("Connect OpenAI in the app before running the highlights evaluation.");
if (status.briefingModel !== "gpt-6.1-sol") throw new Error("Restart the app server to load the new highlights model before evaluating.");
const date = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(new Date());
const section = (title, content, mode = "live") => ({ title, mode, content: JSON.stringify({ source: "Fictional evaluation fixture; not a real observation", content }) });
const quiet = [
  section("Weather", { condition: "rain", temperature: 64, wind: 5, units: "fahrenheit; wind mph", days: [{ date, precipitation: 40, high: 68, low: 54 }] }),
  section("Calendar", [{ title: "Weekly team check-in", date, time: "10:00 AM", notes: "Routine updates; no decisions needed." }]),
  section("Markets", [{ symbol: "TSLA", name: "Tesla", change: -0.8, session: "latest close", asOf: date, freshness: "latest session" }]),
  section("Tasks", [{ title: "Pick up groceries", overdue: true, due: date }]),
  section("Headlines", [{ title: "NASA shares a new instrument update", description: "Routine progress update on a planned instrument.", publishedAt: date }]),
];
const cases = [
  { name: "Ordinary day stays quiet", sections: quiet, check: text => text === "Nothing noteworthy in the available updates." },
  { name: "Dramatic tracked-stock move", sections: [section("Markets", [{ symbol: "TSLA", name: "Tesla", change: -12.4, session: "latest close", asOf: date, freshness: "latest reported session" }]), ...quiet.filter(item => item.title !== "Markets")], check: text => /TSLA/.test(text) && /12\.4\s?%/.test(text) && !/groceries|check-in|rain|NASA|IEX|coverage|reported session/i.test(text) },
  { name: "Stock moves include researched context", sections: [section("Markets", [
    { symbol: "TSLA", kind: "stock", change: -10.8, session: "2026-11-05 regular close", asOf: "2026-11-05T21:00:00Z", freshness: "IEX only; limited coverage" },
    { symbol: "SPCX", kind: "stock", change: -9.1, session: "2026-11-05 regular close", asOf: "2026-11-05T21:00:00Z", freshness: "IEX only; limited coverage" },
  ]), section("Calendar", [{ title: "Contract approval", date, time: "2:00 PM", notes: "Final approval before tomorrow's signing deadline. The purchase contract expires without today's approval." }])], check: (text, result) => /TSLA/.test(text) && /SPCX/.test(text) && /10\.8\s?%/.test(text) && /9\.1\s?%/.test(text) && /merger|midterm|election|data.center|regulat/i.test(text) && /contract/i.test(text) && /2(?::00)?\s?PM/i.test(text) && !/IEX|coverage|based on/i.test(text) && text.split("\n\n").length === 2 && result.citations?.length > 0 },
  { name: "High-stakes meeting supported by full notes", sections: [section("Calendar", [{ title: "Contract review", date, time: "2:00 PM", notes: "Final approval meeting before tomorrow's signing deadline. Without approval, the purchase contract expires." }]), ...quiet.filter(item => item.title !== "Calendar")], check: text => /contract/i.test(text) && /2(?::00)?\s?PM/i.test(text) && /deadline|approv|expir|sign/i.test(text) },
  { name: "Consequential Headlines stay out of AI summary", sections: [section("Headlines", [{ title: "Major power failure shuts airports across the country", description: "Authorities confirm a nationwide grid disruption. All commercial flights are grounded until further notice, affecting millions of passengers.", publisher: "Fictional test newswire", publishedAt: date }], "sample"), ...quiet.filter(item => item.title !== "Headlines")], check: text => text === "Nothing noteworthy in the available updates." },
  { name: "Independent module checks retain more than four important developments", sections: [
    section("Markets", [{ symbol: "ACME", change: -10.8, session: `${date} regular close`, asOf: date }], "sample"),
    section("Calendar", [{ title: "Contract approval", date, time: "2:00 PM", notes: "Final approval before tomorrow's signing deadline; missing approval cancels the purchase contract." }], "sample"),
    section("Weather", { location: "Las Vegas, NV", wind: 65, units: "fahrenheit; wind mph", condition: "storm", warning: "Damaging wind warning today. Power outages and hazardous travel expected." }, "sample"),
    section("Tasks", [{ title: "Submit insurance appeal", due: `${date} 5:00 PM`, notes: "Coverage for tomorrow's scheduled procedure is lost unless the appeal is submitted by 5 PM today." }], "sample"),
    section("Headlines", [{ title: "Regional airport closed until tomorrow", description: "A major power failure grounded all flights at the regional airport until tomorrow.", publishedAt: date }], "sample"),
    section("Projects", [{ name: "Production service", blocker: "Required approval for certificate renewal has not been granted.", next: "Certificate expires tonight; production will go offline unless renewed." }], "sample"),
    section("Around you", [{ title: "Weekly food market", date, venue: "Local park", description: "Routine weekly event with no disruptions." }], "sample"),
  ], check: text => /ACME/.test(text) && /10\.8\s?%/.test(text) && /contract/i.test(text) && /wind/i.test(text) && /insurance|appeal/i.test(text) && /certificate/i.test(text) && !/food market|local park|airport|flight/i.test(text) && text.split("\n\n").length === 5 && text.split("\n\n").every(paragraph => Array.from(new Intl.Segmenter("en", { granularity: "sentence" }).segment(paragraph)).length === 1) },
  { name: "Synthetic shock cannot contaminate live quiet day", sections: [...quiet.filter(item => item.title !== "Markets"), section("Markets", [{ symbol: "TSLA", change: -18.5, session: "latest close", asOf: date }], "sample")], check: text => text === "Nothing noteworthy in the available updates." },
  { name: "Noisy importance labels do not create stakes", sections: [section("Calendar", [{ title: "IMPORTANT meeting with CEO", date, time: "11:00 AM", calendar: "Work", notes: "Recurring weekly informal check-in. No decisions or deadlines." }]), section("Headlines", [{ title: "BREAKING: NASA posts new image", description: "A routine gallery update featuring an existing image.", publishedAt: date }])], check: text => text === "Nothing noteworthy in the available updates." },
];

console.log("Fictional evaluation inputs only. This uses paid API requests within the app's shared allowance.");
const filter = process.argv.find(argument => argument.startsWith("--filter="))?.slice("--filter=".length).toLowerCase();
const selected = filter ? cases.filter(item => item.name.toLowerCase().includes(filter)) : cases;
if (!selected.length) throw new Error("No evaluation cases match the filter.");
let failures = 0;
for (const item of selected) {
  const response = await fetch(`${root}/briefing-summary`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sections: item.sections }), signal: AbortSignal.timeout(95000),
  });
  const result = await response.json();
  const passed = response.ok && typeof result.text === "string" && item.check(result.text, result);
  if (!passed) failures++;
  console.log(`${passed ? "PASS" : "FAIL"} ${item.name}: ${result.text || result.error}`);
}
console.log(`${selected.length - failures}/${selected.length} scenarios passed.`);
process.exitCode = failures ? 1 : 0;
