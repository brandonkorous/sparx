// The opening block of every page that is not the homepage.
//
// One component rather than a hand-built heading per page, because the thing
// that makes a set of pages feel like a site is that they start the same way.
// The homepage deliberately does NOT use it — its opening is the video, and a
// homepage that opened like an interior page would have nothing to announce.
//
// `eyebrow` is not a prop and will not be added. Root RULE #2 bans the slot, not
// the markup: a kicker, a category chip, a step number and a <Badge> in that
// position are the same anti-pattern. If a page needs to say what section it
// belongs to, the heading says it.

export function PageHero({
  heading,
  lede,
  children,
  className = '',
}: {
  heading: string;
  lede: string;
  /** Calls to action, or anything else that belongs above the fold. */
  children?: React.ReactNode;
  /** Set by the app pages to carry a group hue via `data-group`. */
  className?: string;
}) {
  return (
    <section className={`bg-base-100 border-base-300 border-b px-6 py-16 sm:py-24 ${className}`}>
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-8 lg:grid-cols-3 lg:gap-16">
          <h1 className="text-4xl leading-tight font-extrabold sm:text-5xl lg:col-span-2">
            {heading}
          </h1>
          <div className="lg:pt-2">
            <p className="text-lg">{lede}</p>
            {children ? <div className="mt-8 flex flex-wrap gap-3">{children}</div> : null}
          </div>
        </div>
      </div>
    </section>
  );
}
