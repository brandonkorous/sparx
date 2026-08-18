import { Badge, Button } from '@wizeworks/silicaui-react';
import { getModuleColor, type MarketingModule, Section, SectionHeader } from './primitives';
import { Dot } from './primitives';

/**
 * More structural devices for the /crm page (split from crm-sections.tsx for
 * cohesion / line budget):
 *
 *  - CrmOneRecord ... BEAT 3, the false fix: a stack of tools trading webhooks
 *    vs. ONE sparx record, joined by a connector arrow that rotates to point
 *    down when the panels stack.
 *  - CrmTurn ........ BEAT 4, the turn — layer 5, painted in the module's own
 *    hue. The two live together because they are one argument in two halves:
 *    the problem the reader walks into, then the thing only sparx does about it.
 *
 * Grounded in docs/11 + the dashboard activity-timeline.tsx event vocabulary.
 *
 * Class-based per SILICA-VOCABULARY.md. Panel header labels are device chrome.
 *
 * Every contrast failure measured on /crm lived in this file — ten of them, all
 * two defects repeated: `text-warning` as an ink (1.79:1) and `bg-soft` paired
 * with the same hue as ink (2.15:1). Both are fixed below and both are noted at
 * the site so the pattern doesn't come back.
 */

const M = getModuleColor('crm');

// The "usual stack" drift markers. `--color-warning` is `#f2b84b`, an amber that
// measures 1.79:1 on white — it is a FILL color, not an ink, and as 14px text it
// was the worst contrast on the page. `--color-error` (`#b42318`) is 6.57:1 on
// white and 6.02:1 on base-200.
//
// It is also the more accurate semantic. These tags label the mechanisms that
// BREAK the reader's data — a webhook that drifted, a sync that failed, a
// spreadsheet kept by hand. That is a failure, not something to keep an eye on.
//
// It is a CLASS, not a `var()` value, for the same reason `fillOf` returns `.bg`
// below: `<Dot>`'s legacy `color` prop paints through an inline `style`, while
// its `fill` prop applies a utility. A component whose prop is a color string
// forces every caller to hand it one — which is how ~85 dots across the
// marketing site came to stamp `background-color:var(--color-module-…)` into the
// rendered markup.
const BROKEN = 'bg-error';

function fillOf(module: MarketingModule): string {
  return getModuleColor(module).bg;
}

// ── ONE-RECORD PROOF (before / after) ───────────────────────────────────────────
export function CrmOneRecord() {
  const before: { module: MarketingModule | 'warn'; label: string; tag: string }[] = [
    { module: 'commerce', label: 'Store platform — the order', tag: 'webhook ↻' },
    { module: 'crm', label: 'Bolt-on CRM — a copy of the customer', tag: 'webhook ↻' },
    { module: 'email', label: 'Email tool — its own list', tag: 'sync ↻' },
    { module: 'b2b', label: 'Spreadsheet — the “real” numbers', tag: 'manual' },
  ];
  const after: { module: MarketingModule; label: string }[] = [
    { module: 'commerce', label: 'orders & spend' },
    { module: 'email', label: 'email engagement' },
    { module: 'crm', label: 'segments & pipeline' },
    { module: 'ai', label: 'AI conversations' },
  ];
  return (
    <Section padding="lg">
      {/* BEAT 3 — THE FALSE FIX. Same before/after device, re-framed from a spec
          comparison into a plot beat. The old headline ("The records never
          disagree, because there's only one") answered a vendor-shopping
          question and gave away the turn one section early; this one describes
          what happens to the reader when they take the obvious next step. */}
      <SectionHeader
        accent={M.ink}
        headline="So you buy a CRM, and now the customer exists in five places"
        lede="The usual answer is another app that keeps its own copy of your customer and trades updates with your store. Then there are two versions, then three, and the one open in front of you is the one that missed the update. You didn’t buy memory. You bought reconciliation."
      />
      <div className="mt-[52px] flex flex-col items-stretch gap-0 lg:flex-row">
        <div className="min-w-0 flex-1">
          <Panel header="the usual stack" headerDot={BROKEN}>
            {before.map((row, i) => (
              <div
                key={row.label}
                className={`flex items-center gap-[11px] px-5 py-[13px] text-sm ${
                  i === 0 ? '' : 'border-base-200 border-t'
                }`}
              >
                <Dot fill={row.module === 'warn' ? BROKEN : fillOf(row.module)} size={8} />
                <span className="min-w-0">{row.label}</span>
                <span className="text-error ml-auto shrink-0 font-mono text-sm">{row.tag}</span>
              </div>
            ))}
          </Panel>
        </div>
        <div className="mkt-arrow-connector" aria-hidden>
          <svg
            width="26"
            height="26"
            viewBox="0 0 24 24"
            fill="none"
            stroke={M.color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <Panel header="sparx · one database" headerDot={M.bg} accent>
            <div className="px-5 pt-4 pb-[18px]">
              <div className="flex items-center gap-[11px] pb-1">
                {/* SOLID, not `bg-soft`. `${M.bg} bg-soft ${M.ink}` paints the
                    raw accent over a 15% tint of ITSELF — measured 2.15:1, and
                    it was on this page five times. The solid fill carries its
                    own paired ink at 5.52:1 and needs no border to hold an edge. */}
                <span className="bg-module-crm text-module-crm-content flex size-[30px] shrink-0 items-center justify-center rounded-full text-sm font-medium">
                  DR
                </span>
                <span className="text-sm font-medium">one customer, one row</span>
              </div>
              {after.map((row) => (
                <div
                  key={row.label}
                  className="border-base-200 flex items-center gap-[11px] border-t py-2.5 text-sm"
                >
                  <Dot fill={fillOf(row.module)} size={8} />
                  <span>{row.label}</span>
                  {/* Same `bg-soft` defect as the monogram above, ×4. A solid
                      <Badge> resolves fill and ink together, which is the whole
                      reason to reach for the component instead of two utilities. */}
                  <Badge color="module-crm" variant="solid" size="sm" className="ml-auto font-mono">
                    live
                  </Badge>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </Section>
  );
}

// ── THE TURN (LAYER 5) ────────────────────────────────────────────────────────
//
// Beat 4, and the pivot of the whole page: the one thing only sparx can say,
// given its own section in the module's own hue.
//
// It is painted `module-crm` — cyan `#06b6d4` with its measured `-content` ink
// `#083344` (5.52:1, clears AA for body text; white on this fill does NOT, which
// is why the token pairs a dark navy). LAYER 5 in DESIGN.md §2.5, and the only
// section on the page that fills with the module color — everywhere else cyan
// is a signal. One painted identity band per page; a second turns identity into
// wallpaper.
//
// Deliberately the least device-y section here. The turn is a statement, not a
// diagram, and the page already carries five rendered mockups — the fill IS the
// device. No `accent` spark either: a `text-module-crm` full stop on a
// `bg-module-crm` field is cyan on cyan.
export function CrmTurn() {
  const beats: { title: string; body: string }[] = [
    {
      title: 'Nothing to import',
      body: 'Your customers are already here — they are the same people who placed the orders and opened the emails. Switching CRM on doesn’t move a single row, and there is no migration weekend to schedule.',
    },
    {
      title: 'Nothing to sync',
      body: 'There is no second copy of anyone, so nothing can quietly drift out of date overnight. No connector to configure, no webhook to babysit, nothing in the middle that can be down.',
    },
    {
      title: 'Nothing to reconcile',
      body: 'The number in a report and the number on the customer’s page are read from the same place, so they agree by default — and when one changes, it has already changed everywhere.',
    },
  ];
  return (
    <Section surface="module" module="crm" padding="lg">
      {/* A bare <h2>, not <SectionHeader> and not <Display>.

          Not SectionHeader: every other section on the page runs its 30px silica
          h2, and at that size on a full-width painted band the climax read
          QUIETER than the sections it is the payoff for. Hierarchy is scale, so
          the turn takes the biggest type on the page after the hero, and the
          lede runs wider than the standard 640px so the band isn't half empty.

          Not Display either: `<Display>` stamps `text-base-content` whenever no
          `color` is passed, which would override the ink this band already
          resolved (`text-module-crm-content`) — a component painting over its
          surface, RULE #1. The clamp is a literal arbitrary class, so Tailwind's
          scanner sees it and no inline style is needed to get fluid type.

          No <Spark>: the accent full stop is `text-module-crm`, which on a
          `bg-module-crm` field is cyan on cyan. */}
      <h2 className="max-w-[15ch] text-[clamp(34px,5vw,64px)] leading-[1.03] font-medium tracking-[-0.03em] sm:max-w-none">
        There’s nothing to import. It’s already your data.
      </h2>
      <p className="mt-7 max-w-[860px] text-2xl leading-[1.45]">
        sparx isn’t a CRM bolted onto a store. Whatever else you run here — orders, emails, quotes,
        invoices — is already in the same place the customer record reads from. So switching CRM on
        doesn’t move your data anywhere. It just stops keeping it in separate rooms.
      </p>
      <div className="mt-16 grid grid-cols-1 gap-x-10 gap-y-9 sm:grid-cols-3">
        {beats.map((b) => (
          <div key={b.title}>
            <h3 className="text-2xl font-medium tracking-[-0.02em]">{b.title}</h3>
            <p className="text-md mt-3 leading-[1.55]">{b.body}</p>
          </div>
        ))}
      </div>
      {/* THE CLIMAX GETS THE ASK. This band is the point of highest conviction on
          the page — the reader has just been shown the problem, the false fix and
          the way out — and it originally offered them nowhere to go. The hero and
          the footer had buttons; the one beat that earns a decision did not.

          The wording is the claim, made actionable: the whole argument above is
          that there is no migration and no setup, so the button says the thing
          that is true HERE rather than repeating "Activate CRM" a third time.

          A painted band is not a theme scope, so the control is SOLID — `neutral`
          (near-black) on cyan, the same pairing the Ember pricing band uses, and
          measured 5.69:1. An `outline`/`ghost` button would ink itself from the
          LIGHT theme and land near-black-on-cyan by accident rather than design.
          The supporting line can sit at normal body size because cyan IS a
          reading ground at 5.52:1 — unlike Ember, which is display-only. */}
      <div className="mt-14 flex flex-wrap items-center gap-x-7 gap-y-4">
        <Button color="neutral" size="xl">
          Switch CRM on →
        </Button>
        <p className="text-md">Free for fourteen days. Nothing to move, nothing to set up.</p>
      </div>
    </Section>
  );
}

function Panel({
  header,
  headerDot,
  accent,
  children,
}: {
  header: string;
  /** A fill CLASS (`bg-module-crm`, `bg-error`) — feeds `<Dot fill>`, never `color`. */
  headerDot: string;
  accent?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`bg-base-100 border-base-300 h-full overflow-hidden rounded-2xl border-x border-b ${
        accent ? 'border-t-module-crm border-t-[3px]' : 'border-t'
      }`}
    >
      {/* Panel caption — device chrome naming the two stacks being compared. */}
      <div className="border-base-300 flex items-center gap-[9px] border-b px-5 py-[15px] font-mono text-sm">
        <Dot fill={headerDot} size={8} />
        {header}
      </div>
      {children}
    </div>
  );
}
