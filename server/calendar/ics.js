// ics.js — turn a Scout plan into a calendar (.ics) anyone can import.
//
// Generates a standard iCalendar feed from a composed/shared plan: each day's
// items become timed events. Works with Google Calendar, Apple Calendar, Outlook —
// no API key, no OAuth, no external dependency. The "add this trip to my calendar"
// feature, fully self-contained.

const SLOT_TIME = { arrival: ["09:00", 1], morning: ["09:30", 2], midday: ["12:00", 1.5], afternoon: ["14:00", 2.5], evening: ["18:00", 2], extra: ["16:00", 1.5], rest: ["13:00", 1] };

function esc(s) {
  return String(s || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}
const pad = (n) => String(n).padStart(2, "0");
function fmt(d) {
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
}
// Default start: the next Saturday from today.
function nextSaturday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7 || 7));
  return d;
}

export function planToICS(plan, { startDate } = {}) {
  if (!plan) throw new Error("plan required");
  const start = startDate ? new Date(startDate + "T00:00:00") : nextSaturday();
  const stamp = fmt(new Date());
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//ScoutFoxGo//Scout//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", `X-WR-CALNAME:${esc(plan.destination || "Scout trip")} — Scout plan`];

  (plan.days || []).forEach((day, di) => {
    const date = new Date(start);
    date.setDate(start.getDate() + (Number(day.day || day.day_number || di + 1) - 1));
    (day.items || []).forEach((it, ii) => {
      const [t, hrs] = SLOT_TIME[it.slot] || ["10:00", 1.5];
      const [hh, mm] = t.split(":").map(Number);
      const s = new Date(date); s.setHours(hh, mm, 0, 0);
      const e = new Date(s.getTime() + hrs * 3600000);
      lines.push(
        "BEGIN:VEVENT",
        `UID:scout-${(plan.destination || "trip").replace(/\W+/g, "")}-${di}-${ii}-${stamp}@scoutfox`,
        `DTSTAMP:${stamp}`,
        `DTSTART:${fmt(s)}`,
        `DTEND:${fmt(e)}`,
        `SUMMARY:${esc(it.title)}`,
        `DESCRIPTION:${esc([it.reason, it.price ? `Est. $${it.price}` : ""].filter(Boolean).join(" · "))}`,
        `LOCATION:${esc(plan.destination || "")}`,
        "END:VEVENT"
      );
    });
  });
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}
