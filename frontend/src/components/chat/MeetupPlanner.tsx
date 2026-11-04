"use client";

import { CalendarPlus } from "lucide-react";
import { useState } from "react";
import { MeetupForm } from "@/components/chat/MeetupForm";
import { Button } from "@/components/ui/button";

interface MeetupPlannerProps {
  listingId: string;
  partnerId: string;
}

/**
 * "Plan meetup" above the chat box. The form stays closed until it is tapped, so the messages
 * keep their room on small screens. The page leaves it out until the thread has a message, and
 * while a meetup is accepted (the API refuses both).
 */
export function MeetupPlanner({ listingId, partnerId }: MeetupPlannerProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (isOpen) return <MeetupForm listingId={listingId} partnerId={partnerId} onClose={() => setIsOpen(false)} />;
  return (
    // On the thread card, "secondary" is the card's own colour: the border and inset fill (as on
    // the meetup card) show it is a button.
    <Button variant="secondary" size="sm" className="self-start border-brand-600/40 bg-inset" onClick={() => setIsOpen(true)}>
      <CalendarPlus aria-hidden="true" />
      Plan meetup
    </Button>
  );
}
