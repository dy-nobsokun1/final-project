import assert from "node:assert/strict";
import { test } from "node:test";
import { formatMeetupTime, MAX_MEETUP_DAYS, meetupTimeError } from "../src/utils/meetups.js";

const NOW = new Date("2026-11-05T03:00:00Z");
const hoursFromNow = (hours) => new Date(NOW.getTime() + hours * 60 * 60 * 1000).toISOString();

test("a meetup time must be in the future and within 14 days", () => {
  assert.equal(meetupTimeError(hoursFromNow(1), NOW), null);
  assert.equal(meetupTimeError("2026-11-05T15:30:00+07:00", NOW), null);
  assert.equal(meetupTimeError(hoursFromNow(MAX_MEETUP_DAYS * 24), NOW), null);
  assert.match(meetupTimeError(hoursFromNow(MAX_MEETUP_DAYS * 24 + 1), NOW), /within the next 14 days/);
  assert.match(meetupTimeError(NOW.toISOString(), NOW), /future/);
  assert.match(meetupTimeError(hoursFromNow(-1), NOW), /future/);
  // Only an ISO time with its zone: "2026-11-06 15:30" could mean any time zone.
  for (const bad of [undefined, "", "tomorrow at 5", "2026-11-06 15:30", "2026-11-06T15:30", 1762311600000]) {
    assert.match(meetupTimeError(bad, NOW), /Pick a date and time/);
  }
});

test("meetup times are shown in Phnom Penh time (UTC+7)", () => {
  // Some Node versions put a narrow no-break space before "PM", so spaces are compared as plain ones.
  const shown = (iso) => formatMeetupTime(iso).replace(/\s/g, " ");
  assert.equal(shown("2026-11-06T08:30:00Z"), "Fri, Nov 6, 2026, 3:30 PM");
  // 20:00 UTC is already the next morning in Phnom Penh.
  assert.equal(shown("2026-11-06T20:00:00Z"), "Sat, Nov 7, 2026, 3:00 AM");
});
