import { MapPin, QrCode, ShieldCheck } from "lucide-react";

/** The three things a first-time visitor most needs to know: who it is for, how paying works, and where to meet. */
const POINTS = [
  { icon: ShieldCheck, title: "Verified students only", text: "Join with school email (name@aupp.edu.kh)" },
  { icon: QrCode, title: "Flexible payment", text: "KHQR or card online, or cash in person." },
  { icon: MapPin, title: "Meet on campus", text: "Chat in the app, then hand it over at school." },
];

/**
 * Three short points under the hero's subheading. A compact list on phones, so the hero does not
 * grow much there, and a row of three small cards from `sm` up. From `lg` up it stops short of the
 * hero photos on the right.
 */
export function HeroPoints() {
  return (
    <ul className="grid gap-3 text-brand-ink sm:grid-cols-3 lg:max-w-[38rem]">
      {POINTS.map(({ icon: Icon, title, text }) => (
        // Icon, then title, then the line. On phones the icon sits left of both (two rows); in
        // the narrow cards from `sm` up it sits beside the title and the line runs full width.
        <li
          key={title}
          className="grid grid-cols-[auto_1fr] items-center gap-x-2.5 sm:gap-y-1.5 sm:rounded-xl sm:border sm:border-border sm:bg-brand-50/70 sm:p-3"
        >
          {/* #E6F2DD on #22312D is 11.72:1, like the hero's "Browse listings". */}
          <span
            aria-hidden="true"
            className="row-span-2 flex size-8 items-center justify-center rounded-full bg-brand-deep text-brand-50 sm:row-span-1 sm:size-7"
          >
            <Icon className="size-4" />
          </span>
          <p className="text-sm font-semibold leading-5">{title}</p>
          <p className="text-xs leading-4 sm:col-span-2">{text}</p>
        </li>
      ))}
    </ul>
  );
}
