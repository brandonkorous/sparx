import { Badge, Button } from '@wizeworks/silicaui-react';
import { Container, Display, Dot, getModuleColor, Spark } from './primitives';
import { Cycle } from './cycle';
import { EXAMPLE_BUSINESSES, type ExampleBusiness } from '@/lib/example-businesses';

/**
 * The markup-heavy structural devices for the /crm page, split out of
 * crm-page.tsx so each file stays cohesive:
 *
 *  - CrmHero ........... tinted-band hero: split copy + the UNIFIED CUSTOMER
 *    RECORD card (stats + module-colored signals) that crossfades through
 *    EXAMPLE_BUSINESSES so CRM reads as the spine for ANY business. The marquee
 *    device — one person, a signal from every module, colored by source.
 *  - RecordCard ........ the record itself.
 *
 * Grounded in docs/11 (CRM PRD) + the real dashboard CRM surfaces (record
 * stats, activity event vocabulary). CRM cyan is a signal, not fill.
 *
 * Class-based per SILICA-VOCABULARY.md. This header used to note that "the only
 * inline styles left are the per-module hue VALUES the record's signal dots and
 * the avatar ring need" — none of those remain: the signal rows became solid
 * `<Badge color="module-…">`, the avatar became a real photograph, and every
 * `<Dot>` on the page now takes a fill CLASS rather than a `var()` value.
 */

const M = getModuleColor('crm');

// `sourceColor()` lived here to feed a per-signal <Dot color={…}> as a VALUE.
// The signal rows now carry their module hue as a solid <Badge color="module-…">
// instead, which is a class the plugin resolves — so the helper, and the inline
// style it existed to produce, are both gone.

// ── HERO ──────────────────────────────────────────────────────────────────────
export function CrmHero() {
  // BEAT 1 — THE PROMISE, in the reader's words rather than the system's.
  //
  // This lede was: "sparx CRM is the customer spine — profiles, activity,
  // segments, pipeline, and automation, all on the same database as your orders,
  // emails, and quotes. No sync, no Zapier, no 'which system is right?' The
  // record is the record." Six product nouns and a named third-party tool, aimed
  // at someone already shopping for a CRM. The reader this page is written for
  // is a non-technical owner who has not decided they want one
  // (docs/brain/business/audience.md), so the promise has to be stated as
  // something that happens to them, not as an architecture.
  const lede =
    'Every order they placed, every email they opened, every quote you sent them — it is all already somewhere in your business. sparx keeps it on one page, so whoever is serving them can see it without coming to ask you first.';
  // Four claims, four hues — each the colour of the thing it names, so the row
  // reads as four different promises instead of four copies of one. They were
  // four identical pale pills, each led by the same small cyan dot. Re-worded
  // off product vocabulary for the same reason as the lede: "One record, every
  // module" and "Pipeline + forecast" name parts of the software, and a visitor
  // who does not already know what a module is learns nothing from either.
  const chips: { label: string; color: string }[] = [
    { label: 'One page per customer', color: 'module-crm' },
    { label: 'Groups that keep themselves up to date', color: 'module-email' },
    { label: 'See what is likely to close', color: 'info' },
    { label: 'Nothing to sync, ever', color: 'success' },
  ];
  return (
    // A real dark island, not a pale wash. This was `${M.bg} bg-soft` — the
    // module hue at ~5% flooded across the entire hero, measured `#e3f4f9`.
    // RULE #3 calls that out directly: soft is an accent for the ONE thing that
    // earns it, never a page background. Flooding it here also made the hue
    // useless everywhere else on the page, because a 5% cyan field is the
    // faintest possible version of the colour the rest of the page needs to
    // mean something — and /crm leans on that colour 53 times.
    //
    // `data-theme="dark"` re-resolves every token underneath rather than
    // painting, so the buttons, badges and prose inside need no dark variants —
    // and it is where module hues finally become legible as INK (~7:1, against
    // ~2.2:1 on the wash). Same house hero as /commerce, /features and /pricing.
    <section data-theme="dark" className="bg-base-100 px-page rounded-b-4xl pt-20 pb-28">
      <Container>
        <div className="flex flex-col items-center gap-[clamp(40px,6vw,72px)] lg:flex-row">
          <div className="min-w-0 flex-1">
            {/* The thesis of the page AND of sparx, in one line: the knowledge
                already exists, it is just scattered. It sets up beat 4 ("nothing
                to import — it's already your data") six sections early, and the
                record card beside it is the literal illustration — one person,
                carrying activity from four different parts of the platform. */}
            <Display as="h1" size={84} lineHeight={80}>
              Your business already knows this customer
              <Spark color={M.ink} />
            </Display>
            <p className="mt-7 max-w-[560px] text-[clamp(16px,1.6vw,20px)] leading-[1.55]">
              {lede}
            </p>
            <div className="mt-[34px] flex flex-wrap items-center gap-3">
              <Button color="primary" size="lg">
                Activate CRM →
              </Button>
              <a href="#record">
                <Button size="lg" variant="outline">
                  See a customer record
                </Button>
              </a>
            </div>
            {/* Solid badges, which is the legible way to carry a hue: silica
                paints each fill with its own paired ink, so all four read at
                full contrast on the dark island with no colour decision here. */}
            <ul className="mt-[26px] flex list-none flex-wrap items-center gap-2.5 p-0">
              {chips.map((c) => (
                <li key={c.label}>
                  <Badge color={c.color} variant="solid" size="lg">
                    {c.label}
                  </Badge>
                </li>
              ))}
            </ul>
          </div>
          {/* A nested LIGHT island, so the record stays a real white product
              surface floating on the near-black hero instead of dissolving into
              it. `rounded-2xl` is load-bearing, not decoration: a `data-theme`
              scope is a theme ROOT, so it PAINTS its own base surface and is a
              visible box in its own right. Left square it would wrap the card's
              own 16px corners in a hard-edged white rectangle. Anything carrying
              `data-theme` needs the shape of the surface it stands in for. */}
          <div
            id="record"
            data-theme="light"
            className="w-full min-w-0 flex-1 scroll-mt-20 rounded-2xl"
          >
            <Cycle
              items={EXAMPLE_BUSINESSES.map((b) => (
                <RecordCard key={b.domain} business={b} />
              ))}
            />
          </div>
        </div>
      </Container>
    </section>
  );
}

/** The hero's product-surface proof — one real customer record, every module's
 *  signal attached, colored by source. Crossfades through EXAMPLE_BUSINESSES;
 *  every scene has the same 3 stats + 5 signals so the card never reflows. */
function RecordCard({ business }: { business: ExampleBusiness }) {
  const { crm, customer } = business;
  return (
    // No `shadow-lg` — shadows are banned as a visual device, and inside the
    // dark hero the border plus the base-tone shift already separate this card.
    <div className="bg-base-100 border-base-300 overflow-hidden rounded-2xl border">
      <div className="border-base-300 flex items-center gap-[13px] border-b px-5 py-[18px]">
        {/* THE CUSTOMER, not their initials. This is a record about a person and
            the marquee device of the page; a monogram is what you show when you
            have no photograph, so leading with one made the demo record look
            like an empty seat. It was also the page's single worst contrast
            failure — `${M.bg} bg-soft ${M.ink}` is the accent inked over a 15%
            tint of itself, measured 2.15:1.

            `object-top`, not centre: these are standing portraits and a centred
            square crop of one lands on the torso. `alt` carries the name because
            here the photo IS the identity — unlike the product thumbnails in the
            /commerce mockups, which are decorative and sit beside their own
            label. */}
        <img
          src={crm.avatar}
          alt={customer.name}
          width={42}
          height={42}
          loading="lazy"
          decoding="async"
          className="border-base-300 size-[42px] shrink-0 rounded-full border object-cover object-top"
        />
        <span className="min-w-0">
          <span className="text-md block font-medium">{customer.name}</span>
          {/* Record chrome inside the mimicked CRM surface. */}
          <span className="font-mono text-sm">{crm.type} · one record · 5 live signals</span>
        </span>
        <Dot fill={M.bg} size={9} />
      </div>
      <div className="border-base-300 grid grid-cols-3 border-b">
        {[
          [crm.totalSpent, 'total spent'],
          [String(crm.orders), 'orders'],
          [crm.avgOrder, 'avg order'],
        ].map(([v, l], i) => (
          <div key={l} className={`px-[18px] py-3.5 ${i === 0 ? '' : 'border-base-200 border-l'}`}>
            <div className="text-lg font-medium tracking-[-0.01em]">{v}</div>
            <div className="mt-0.5 font-mono text-sm">{l}</div>
          </div>
        ))}
      </div>
      <div className="px-5 pt-1.5 pb-3.5">
        {/* Panel label inside the record UI — device chrome, sentence case. */}
        <div className="pt-3 pb-1 font-mono text-sm">activity · from every module</div>
        {crm.signals.map((s, i) => (
          <div
            key={s.label}
            className={`flex items-center gap-[11px] py-2.5 text-sm ${
              i === 0 ? '' : 'border-base-200 border-t'
            }`}
          >
            {/* THE SOURCE TAG IS THE ARGUMENT. This section's whole claim is
                "one record, every signal, from every module" — and the tag
                naming the module was a grey outlined pill, identical for all
                five. A reader scanning it learned that five things happened,
                not that they came from five different parts of the platform,
                which is the only point being made.

                A solid badge in the module's OWN registered hue says it before
                the label is read, and each fill carries its own paired ink so
                all five stay legible with no per-tag colour decision. The
                leading dot goes: it was a second, fainter statement of exactly
                the same fact. */}
            <span className="min-w-0 flex-1">{s.label}</span>
            <Badge
              color={`module-${s.module}`}
              variant="solid"
              size="sm"
              className="ml-auto shrink-0 font-mono"
            >
              {s.module === 'ai' ? 'mcp' : s.module}
            </Badge>
          </div>
        ))}
      </div>
    </div>
  );
}
