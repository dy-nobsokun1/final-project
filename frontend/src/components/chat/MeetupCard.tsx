"use client";

import { CalendarClock } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { acceptMeetup, cancelMeetup, declineMeetup } from "@/lib/api/actions";
import type { ActionResult } from "@/lib/api/actions";
import { formatMeetupTime, MEETUP_SPOTS } from "@/lib/meetup-spots";
import type { Meetup } from "@/types";

interface MeetupCardProps {
  meetup: Meetup;
  /** Its time has come (worked out by the page, so the server and the browser agree). */
  isPast: boolean;
  meId: string;
  partnerName: string;
}

const HEADINGS: Record<Meetup["status"], string> = {
  proposed: "Meetup proposed",
  accepted: "Meetup confirmed",
  declined: "Meetup declined",
  cancelled: "Meetup cancelled",
};

/** Once its time has come, a waiting or accepted meetup can no longer be answered or cancelled. */
const PAST_HEADINGS: Partial<Record<Meetup["status"], string>> = {
  proposed: "Meetup request expired",
  accepted: "Meetup time has passed",
};

/** One short line under the time: who has to do what next. */
function nextStep(meetup: Meetup, isInvitee: boolean, partnerName: string, isOver: boolean): string {
  if (isOver) return "Plan a new one below if you still need to meet.";
  if (meetup.status === "proposed") return isInvitee ? `${partnerName} asked to meet.` : `Waiting for ${partnerName} to answer.`;
  if (meetup.status === "accepted") return "You both get a reminder 30 minutes before.";
  if (meetup.status === "declined") return isInvitee ? "You declined it." : `${partnerName} cannot make it.`;
  return "Plan a new one below if you still want to meet.";
}

/**
 * The thread's newest meetup, above the messages: where, when, its status, and the buttons the
 * signed-in student may use (the invitee accepts or declines; either cancels). The page shows a
 * new copy when anything changes, live too (use-live-messages refreshes it on "event: meetup").
 */
export function MeetupCard({ meetup, isPast, meId, partnerName }: MeetupCardProps) {
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isInvitee = meetup.inviteeId === meId;
  const pastHeading = isPast ? PAST_HEADINGS[meetup.status] : undefined;
  const canAnswer = !pastHeading && meetup.status === "proposed" && isInvitee;
  const canCancel = !pastHeading && (meetup.status === "accepted" || (meetup.status === "proposed" && !isInvitee));

  async function run(action: (meetupId: string) => Promise<ActionResult>) {
    setIsBusy(true);
    setError(null);
    const result = await action(meetup.id);
    setIsBusy(false);
    if (result.error) setError(result.error);
  }

  return (
    <section
      aria-label="Meetup"
      className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-brand-600/40 bg-inset px-3 py-2 text-sm text-foreground"
    >
      <CalendarClock aria-hidden="true" className="size-5 shrink-0" />
      <div className="min-w-0 flex-1" aria-live="polite">
        <p className="font-semibold">{pastHeading ?? HEADINGS[meetup.status]}</p>
        {/* An explicit time zone, so the server and the browser write the same text. */}
        <p suppressHydrationWarning>
          {MEETUP_SPOTS[meetup.spot] ?? meetup.spot} · {formatMeetupTime(meetup.meetAt)}
        </p>
        <p className="text-xs text-muted-foreground">{nextStep(meetup, isInvitee, partnerName, Boolean(pastHeading))}</p>
      </div>
      {canAnswer ? (
        <div className="flex gap-2">
          <Button size="sm" disabled={isBusy} onClick={() => run(acceptMeetup)}>Accept</Button>
          <Button size="sm" variant="secondary" disabled={isBusy} onClick={() => run(declineMeetup)}>Decline</Button>
        </div>
      ) : null}
      {canCancel ? (
        <Button size="sm" variant="secondary" disabled={isBusy} onClick={() => run(cancelMeetup)}>
          Cancel meetup
        </Button>
      ) : null}
      {error ? <p role="alert" className="w-full text-sm">{error}</p> : null}
    </section>
  );
}
