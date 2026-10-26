'use client';

import * as React from 'react';
import {
  TypingText,
  TypingTextCursor,
} from '@/components/animate-ui/primitives/texts/typing';

const COPY =
  'Buy, sell, trade or give away textbooks, PC parts, bikes and more with other students. Pay online, or in cash when you meet on campus.';

/**
 * Hero subheading, typed out on load.
 *
 * `duration` is milliseconds per character, so 15ms over the 134-character copy
 * lands at about 2s. `delay` starts it just after the heading's entrance so
 * the two animations do not compete. It does not loop -- the copy is meant to be
 * read once, not cycled.
 *
 * The cursor blinks while idle and holds solid while typing, which is the
 * primitive's own behaviour via the shared context.
 *
 * Three copies of the text share one grid cell:
 * - an invisible full copy holds the paragraph at its final height at any width,
 *   so the points and buttons below never move while the text fills in. With
 *   reduced motion it is the one shown, and the typing is hidden;
 * - the typed copy, which screen readers skip, since it changes letter by letter;
 * - a screen-reader-only full copy, read once.
 */
export function HeroSubheading() {
  return (
    <p className="grid max-w-md text-base text-brand-ink">
      <span aria-hidden="true" className="invisible col-start-1 row-start-1 motion-reduce:visible">
        {COPY}
      </span>
      <span aria-hidden="true" className="col-start-1 row-start-1 motion-reduce:hidden">
        <TypingText duration={15} delay={400} text={COPY}>
          <TypingTextCursor className="ml-1 !h-4 !w-[2px] rounded-full" />
        </TypingText>
      </span>
      <span className="sr-only">{COPY}</span>
    </p>
  );
}
