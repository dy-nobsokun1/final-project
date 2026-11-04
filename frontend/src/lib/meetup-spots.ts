/**
 * The campus spots a meetup can be at: the key is what the API stores, the label what students see.
 * The API has the same list (backend/src/utils/meetups.js); change both together.
 * Placeholders until the team names AUPP's real spots. Renaming a label needs no database change.
 */
export const MEETUP_SPOTS: Record<string, string> = {
  library_entrance: "Library entrance",
  cafeteria: "Cafeteria",
  main_gate: "Main gate",
  student_lounge: "Student lounge",
};

/** How far ahead a meetup can be planned (MAX_MEETUP_DAYS in the API). */
export const MAX_MEETUP_DAYS = 14;

/** Phnom Penh is UTC+7 all year (no daylight saving), so a fixed offset is exact. */
const PHNOM_PENH_OFFSET = "+07:00";
const ZONE = "Asia/Phnom_Penh";

/** "2026-11-06" and "15:30" typed on the form, as one moment: "2026-11-06T15:30:00+07:00". */
export function toMeetupTime(date: string, time: string): string {
  return `${date}T${time}:00${PHNOM_PENH_OFFSET}`;
}

/** Today's date in Phnom Penh, `days` ahead, as the date input wants it ("2026-11-06"). */
export function phnomPenhDate(days = 0): string {
  const day = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  return day.toLocaleDateString("en-CA", { timeZone: ZONE }); // en-CA writes dates as YYYY-MM-DD
}

/** "Fri, Nov 6, 3:30 PM": a meetup's time in Phnom Penh, wherever the browser is. */
export function formatMeetupTime(meetAt: string): string {
  return new Date(meetAt).toLocaleString("en-US", {
    timeZone: ZONE,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Whether a meetup's time has come. The thread page works it out once on the server and passes it down. */
export function isMeetupPast(meetAt: string): boolean {
  return new Date(meetAt).getTime() <= Date.now();
}
