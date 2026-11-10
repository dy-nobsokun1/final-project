"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { planMeetup } from "@/lib/api/actions";
import { MAX_MEETUP_DAYS, MEETUP_SPOTS, phnomPenhDate, toMeetupTime } from "@/lib/meetup-spots";

interface MeetupFormProps {
  listingId: string;
  partnerId: string;
  onClose: () => void;
}

/**
 * Pick a campus spot, a date and a time, and send the meetup to the other person. The date and time
 * are Phnom Penh time, whatever the browser's own time zone. The API checks them again.
 */
export function MeetupForm({ listingId, partnerId, onClose }: MeetupFormProps) {
  const [spot, setSpot] = useState(Object.keys(MEETUP_SPOTS)[0]);
  const [date, setDate] = useState(() => phnomPenhDate(1));
  const [time, setTime] = useState("12:00");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSending(true);
    setError(null);
    const result = await planMeetup(listingId, partnerId, spot, toMeetupTime(date, time));
    setIsSending(false);
    if (result.error) setError(result.error);
    else onClose();
  }

  return (
    <form onSubmit={handleSubmit} aria-label="Plan a meetup" className="flex flex-wrap items-end gap-2 rounded-lg border border-brand-600/40 bg-inset p-2">
      <div className="flex flex-col gap-1">
        <Label htmlFor="meetup-spot">Where</Label>
        <Select value={spot} onValueChange={setSpot}>
          <SelectTrigger id="meetup-spot" className="w-40 bg-card">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(MEETUP_SPOTS).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="meetup-date">Date</Label>
        <Input id="meetup-date" type="date" required value={date} min={phnomPenhDate(0)} max={phnomPenhDate(MAX_MEETUP_DAYS)}
          onChange={(event) => setDate(event.target.value)} className="w-40 bg-card" />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="meetup-time">Time</Label>
        <Input id="meetup-time" type="time" required value={time} onChange={(event) => setTime(event.target.value)}
          className="w-32 bg-card" />
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" className="h-8" disabled={isSending}>Send</Button>
        <Button type="button" size="sm" variant="ghost" className="h-8" onClick={onClose}>Close</Button>
      </div>
      {error ? <p role="alert" className="w-full text-sm text-foreground">{error}</p> : null}
    </form>
  );
}
