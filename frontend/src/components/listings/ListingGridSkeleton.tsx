/** One grey bar, standing in for a line of text. */
const BAR = "block h-5 rounded bg-foreground/10";

/**
 * Placeholder cards shaped like `ListingCard`, shown while browse results load. Same grid classes
 * as `ListingGrid`, so nothing moves when the real cards arrive. Screen readers hear one
 * "Loading listings" instead of eight empty cards.
 */
export function ListingGridSkeleton() {
  return (
    <div>
      <p role="status" className="sr-only">
        Loading listings
      </p>
      <ul aria-hidden="true" className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, index) => (
          <li
            key={index}
            className="light-surface flex animate-pulse flex-col overflow-hidden rounded-xl border border-border bg-card motion-reduce:animate-none"
          >
            <span className="block aspect-[4/3] w-full bg-foreground/10" />
            <span className="flex flex-col gap-2 p-3">
              <span className="flex justify-between gap-2">
                <span className={`${BAR} w-2/3`} />
                <span className={`${BAR} w-10`} />
              </span>
              <span className={`${BAR} w-1/2`} />
              <span className={`${BAR} w-24 rounded-full`} />
              <span className={`${BAR} h-4 w-3/4`} />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
