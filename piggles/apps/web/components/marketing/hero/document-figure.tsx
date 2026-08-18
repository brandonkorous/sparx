import { PRODUCT } from '@piggles/config';
import { HeroPanel, HeroRow, HeroRows } from './panel';

// /privacy, /terms, /cookies, /data-processing — what you are about to read,
// before you read it.
//
// The legal pages are the ones most tempting to leave stock, and leaving them
// stock is what makes a site feel like it stopped caring three clicks in. They
// are also the pages where a figure has to be quiet: nobody wants a photograph
// over a privacy notice.
//
// So the figure is the document's own front matter — how long it is, what it
// covers, and when it took effect. Every row is something a reader would
// otherwise have to scroll to work out.
//
// ── NO INVENTED DATE ────────────────────────────────────────────────────────
//
// `effective` is optional and simply absent where a page has no recorded
// effective date. A date typed in to fill a slot is exactly what the platform's
// rule about never presenting absence as measurement forbids — on a legal
// document most of all, where the date is the part with consequences.

export function DocumentFigure({
  sections,
  covers,
  effective,
}: {
  /** How many parts the document is in. Derived from the page's own data. */
  sections: string;
  /** What it applies to, in the reader's terms. */
  covers: string;
  /** The date it took effect. Omitted where the page records none — never
   *  invented to fill the row. */
  effective?: string;
}) {
  return (
    <HeroPanel>
      <div className="border-base-300 border-b px-5 py-3.5">
        <b className="text-base font-bold">About this document</b>
      </div>

      <HeroRows>
        <HeroRow label="How long it is" right={<b className="text-base">{sections}</b>} />
        <HeroRow label="What it applies to" right={<b className="text-base">{covers}</b>} />
        <HeroRow
          label="Written for"
          right={<b className="text-base">The person running the business</b>}
        />
        {effective ? (
          <HeroRow label="In effect from" right={<b className="text-base">{effective}</b>} />
        ) : null}
      </HeroRows>

      <p className="px-5 py-4 text-base font-semibold">
        Everything here describes what {PRODUCT.name} actually does — no clause is in it because
        other companies have one.
      </p>
    </HeroPanel>
  );
}
