"use client";

import { useEffect, useRef } from "react";

/**
 * The listing grid's <ul>. Its cards fade up on first paint (`card-in` in globals.css), but on the
 * home page the hero sits above the grid, so that happened before anyone scrolled down. If the grid
 * starts below the screen, this holds the cards back (data-reveal="wait") and lets them rise once
 * the grid scrolls into view. It runs once per grid; a grid already on screen is left alone.
 */
export function RevealList({ className, children }: { className?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const list = ref.current;
    if (!list || !("IntersectionObserver" in window)) return;
    let first = true;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        delete list.dataset.reveal;
        observer.disconnect();
      } else if (first) {
        list.dataset.reveal = "wait";
      }
      first = false;
    });
    observer.observe(list);
    return () => observer.disconnect();
  }, []);

  return (
    <ul ref={ref} className={className}>
      {children}
    </ul>
  );
}
