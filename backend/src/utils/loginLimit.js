// Limits wrong passwords per account: after `limit` wrong tries in `windowMs`, even the right
// password must wait until the oldest try is `windowMs` old. In memory only, so restarting the API
// clears it. Keyed on the email, not the device, because only the Next.js server calls the API
// (every request comes from the same IP).
// Once this many emails are tracked, each new try first drops the ones whose tries are all old,
// so guesses at many unknown emails cannot fill the memory.
const SWEEP_AT = 1000;

export function createLoginLimiter({ limit, windowMs, now = Date.now }) {
  const tries = new Map(); // email -> times of tries that were not followed by a right password

  function recent(email) {
    const kept = (tries.get(email) ?? []).filter((at) => at > now() - windowMs);
    if (kept.length) tries.set(email, kept);
    else tries.delete(email);
    return kept;
  }

  return {
    // Call BEFORE checking the password. Returns 0 and counts this try, or returns the ms left to
    // wait (a blocked try is not counted, so waiting really ends). Counting happens before any
    // await, so parallel guesses cannot all pass while the count is still low.
    begin(email) {
      if (tries.size >= SWEEP_AT) for (const key of tries.keys()) recent(key);
      const kept = recent(email);
      if (kept.length >= limit) return kept[0] + windowMs - now();
      tries.set(email, [...kept, now()]);
      return 0;
    },
    // The password was right: forget this account's tries.
    succeed(email) {
      tries.delete(email);
    },
    // How many emails are tracked (for the unit test).
    size() {
      return tries.size;
    },
  };
}
