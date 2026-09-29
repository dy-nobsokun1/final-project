'use client';

import * as React from 'react';
import {
  TypingText,
  TypingTextCursor,
} from '@/components/animate-ui/primitives/texts/typing';

const COPY =
  'Textbooks, bikes, furniture and more from students you share a campus with. List an item in under a minute.';

/**
 * Hero subheading, typed out on load.
 *
 * `duration` is milliseconds per character, so 18ms over the 107-character copy
 * lands at roughly 1.9s. `delay` starts it just after the heading's entrance so
 * the two animations do not compete. It does not loop -- the copy is meant to be
 * read once, not cycled.
 *
 * The cursor blinks while idle and holds solid while typing, which is the
 * primitive's own behaviour via the shared context.
 *
 * `min-h` reserves the height of the two rendered lines: the span starts empty,
 * so without it the paragraph would collapse and shove the CTA row downward as
 * the text filled in.
 */
export function HeroSubheading() {
  return (
    <p className="min-h-[3rem] max-w-md text-base text-brand-ink">
      <TypingText duration={18} delay={400} text={COPY}>
        <TypingTextCursor className="ml-1 !h-4 !w-[2px] rounded-full" />
      </TypingText>
    </p>
  );
}