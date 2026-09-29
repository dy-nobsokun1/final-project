'use client';

import * as React from 'react';
import { Effects } from '@/components/animate-ui/primitives/effects/effect';

/**
 * The hero display line, split per word.
 *
 * Each word is an `inline-block` on purpose: the slide/zoom effects apply CSS
 * transforms, and transforms do not apply to non-replaced inline elements, so
 * bare spans would animate nothing. The two `Effects` groups are the two visual
 * lines, with the second carrying a larger base `delay` so "On Campus" starts
 * after "Buy & Sell" has begun. `blur` is softened to 6px because the 10px
 * default is heavy at this type size and reads as out-of-focus rather than
 * in-motion.
 */
export function HeroHeading() {
  return (
    <h1 className="font-heading text-5xl leading-[0.9] tracking-tight text-brand-ink sm:text-7xl">
      {/* `asChild` is required: without it `Effect` renders a `motion.div`
          wrapper per word, and block-level divs stack each word on its own line.
          Slot mode merges the motion props onto each span instead.

          Word gaps come from `mr-*` on each span rather than literal `{" "}`
          separators. `Effects` maps every child through `Effect`, whose
          `WithAsChild` type demands a ReactElement, so a bare string child
          (" ") does not type-check. Right margin reproduces the spacing of the
          original single text run; the last word in each line carries none. */}
      <Effects
        asChild
        slide
        fade
        blur={{ initialBlur: 6 }}
        delay={0}
        holdDelay={90}
      >
        <span className="mr-[0.25em] inline-block">Buy</span>
        <span className="mr-[0.25em] inline-block">&amp;</span>
        <span className="inline-block">Sell</span>
      </Effects>
      <br />
      <Effects
        asChild
        slide
        fade
        blur={{ initialBlur: 6 }}
        delay={240}
        holdDelay={90}
      >
        <span className="mr-[0.25em] inline-block">On</span>
        <span className="inline-block">Campus</span>
      </Effects>
    </h1>
  );
}