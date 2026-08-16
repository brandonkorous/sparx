'use client';

import { useMemo, useState } from 'react';
import { Badge, Button, Heading, Input, Text } from '@wizeworks/silicaui-react';
import {
    CAPABILITY_AREAS,
    STATUS_META,
    type Capability,
    type CapabilityArea,
    type CapabilityStatus,
} from '@/lib/capabilities';

/**
 * The searchable capability index — the whole reason /features exists.
 *
 * ## Why this is a finder and not a list
 *
 * The catalog is 300-odd items. Rendered flat it is a database dump: the old
 * page put all of them on screen as identically-sized grey pills inside 25
 * stacked pastel washes, which is 6,700px of page in which nothing is more
 * important than anything else and no individual item can be found. Breadth was
 * the argument and the form actively destroyed it.
 *
 * A visitor arrives here in one of two states — "can it do <the thing my
 * business needs>?" or "is there enough here?" — and search is the only device
 * that answers both at once: type "appointment" and get the answer in a second;
 * type nothing and the full count is the answer. That is also what keeps this
 * page distinct from /pricing's "Every feature, by module" accordion, which
 * shows six highlights per module and cannot be searched.
 *
 * ## Why the cards are not tinted
 *
 * Each area owns a registered hue, and the previous design spent it on a full
 * `bg-soft` wash per row — 25 pastel bands stacked down the page, which is
 * exactly the failure RULE #3 names: apply soft to everything and it stops
 * meaning anything.
 *
 * The hue now fills the card's HEADER instead, in its paired `-content` ink. That
 * is the only arrangement that survived measurement: a soft tint reads as mush,
 * and the module name set in `text-module-*` runs 1.78:1 to 2.5:1 on white,
 * because these are fill colors and were never legible as ink. A filled header
 * measures 4.6:1 to 8:1 across all twelve — so the loudest hue moment on the page
 * is also its most readable element, and the modules read as a color-coded
 * catalog rather than twelve grey cards or twelve competing washes.
 *
 * ## Why most rows carry no status marker
 *
 * 83% of the catalog is live, so marking every item meant 300 decoder dots whose
 * key sat 6,000px up the page. Silence now means shipped, and only the ~54 items
 * that are NOT yet live carry a badge — which makes the exceptions visible for
 * the first time and states the honest thing plainly.
 */

/** Join class fragments, dropping falsy ones. Local rather than silica's `cx`
 *  from the `/server` subpath, which has no business in a client bundle. */
function cx(...parts: (string | false | null | undefined)[]): string {
    return parts.filter(Boolean).join(' ');
}

type Filter = 'all' | CapabilityStatus;

/**
 * The status filters, colored by what they MEAN — selection is the filled shape
 * (RULE #4), so the active filter is read before its label is. `neutral` on the
 * roadmap tab is earned: it is the genuinely untyped end of the scale.
 */
const FILTERS: { key: Filter; label: string }[] = [
    { key: 'all', label: 'Everything' },
    { key: 'live', label: STATUS_META.live.label },
    { key: 'building', label: STATUS_META.building.label },
    { key: 'planned', label: STATUS_META.planned.label },
];

const FILTER_COLOR: Record<Filter, string> = {
    all: 'primary',
    live: STATUS_META.live.color,
    building: STATUS_META.building.color,
    planned: STATUS_META.planned.color,
};

const TOTALS: Record<Filter, number> = CAPABILITY_AREAS.reduce(
    (acc, area) => {
        for (const cap of area.capabilities) {
            acc.all += 1;
            acc[cap.status] += 1;
        }
        return acc;
    },
    { all: 0, live: 0, building: 0, planned: 0 } as Record<Filter, number>
);

/** Module marketing pages that actually exist as routes. Invoicing, Inventory
 *  and Live Chat have no page yet, so their cards simply omit the link rather
 *  than pointing at a 404. */
const MODULE_HREF: Record<string, string> = {
    builder: '/builder',
    commerce: '/commerce',
    cms: '/cms',
    crm: '/crm',
    email: '/email',
    b2b: '/b2b',
    dropship: '/dropship',
    scheduling: '/scheduling',
    ai: '/ai',
};

interface Group {
    area: CapabilityArea;
    caps: Capability[];
}

/**
 * "6 of 32 in Builder" — rendered only while a filter is active.
 *
 * At rest it would say "32 of 32" on all 25 areas, which is noise; under a
 * filter it is the missing context, because a card showing one row does not
 * otherwise tell you whether that area holds two capabilities or forty.
 */
function MatchCount({ group }: { group: Group }) {
    return (
        <Text className="text-md">
            <span className="font-medium">{group.caps.length}</span> of {group.area.capabilities.length}{' '}
            match
        </Text>
    );
}

export function CapabilityCatalog({ prices }: { prices: Record<string, string> }) {
    const [query, setQuery] = useState('');
    const [status, setStatus] = useState<Filter>('all');

    const groups = useMemo<Group[]>(() => {
        const q = query.trim().toLowerCase();
        return CAPABILITY_AREAS.map((area) => {
            // Matching the AREA (its name or summary) keeps a whole area — searching
            // "commerce" should return Commerce entire, not the four capabilities that
            // happen to repeat the word.
            const areaHit =
                q !== '' && (area.name.toLowerCase().includes(q) || area.summary.toLowerCase().includes(q));
            const caps = area.capabilities.filter(
                (c) =>
                    (status === 'all' || c.status === status) &&
                    (q === '' || areaHit || c.name.toLowerCase().includes(q))
            );
            return { area, caps };
        }).filter((g) => g.caps.length > 0);
    }, [query, status]);

    const shown = groups.reduce((n, g) => n + g.caps.length, 0);
    const modules = groups.filter((g) => g.area.module);
    const platform = groups.filter((g) => !g.area.module);
    const filtered = query.trim() !== '' || status !== 'all';

    return (
        <div className="flex flex-col gap-16">
            {/* ── The finder ──────────────────────────────────────────────────────
          Sticky under the 64px navbar so the controls stay reachable through
          the whole index — an index this long is only searchable if the search
          box is still on screen when you are 4,000px into it. */}
            <div
                id="find"
                className="bg-base-200 border-base-300 sticky top-16 z-40 -mx-6 flex scroll-mt-16 flex-col gap-5 border-b px-6 pt-6 pb-5 sm:-mx-8 sm:px-8"
            >
                <Input
                    type="search"
                    size="lg"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    aria-label="Search capabilities"
                    placeholder={`Search all ${TOTALS.all} — try "appointments", "invoice", "discount", "domain"`}
                />
                <div className="flex flex-wrap items-center gap-2.5">
                    {FILTERS.map((f) => (
                        <Button
                            key={f.key}
                            size="sm"
                            // Color rides the SELECTED filter only. `soft` and `outline` both
                            // paint the label in the raw accent, and measured on this page that
                            // is 1.66:1 for `warning` and 2.0–2.4:1 for half the module hues —
                            // silica derives a soft/outline foreground from the hue itself
                            // rather than from a legible on-tint ink (filed as §2 in
                            // docs/silicaui/02-core-asks.md). `solid` uses the designed
                            // `--color-<c>` / `--color-<c>-content` pairing and is legible for
                            // every hue, so selection wears the color and everything else stays
                            // a plain outline — which is also the stronger read: exactly one
                            // filled shape on the row tells you where you are (RULE #4).
                            {...(status === f.key
                                ? { color: FILTER_COLOR[f.key], variant: 'solid' as const }
                                : { variant: 'outline' as const })}
                            onClick={() => setStatus(f.key)}
                            aria-pressed={status === f.key}
                        >
                            {f.label} · {TOTALS[f.key]}
                        </Button>
                    ))}
                    {filtered ? (
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                                setQuery('');
                                setStatus('all');
                            }}
                        >
                            Clear
                        </Button>
                    ) : null}
                    <Text className="text-md ml-auto">
                        {filtered ? (
                            <>
                                <span className="font-medium">{shown}</span> of {TOTALS.all} shown
                            </>
                        ) : (
                            <>Everything below is live today unless it says otherwise.</>
                        )}
                    </Text>
                </div>
            </div>

            {shown === 0 ? (
                <EmptyState
                    query={query}
                    onClear={() => {
                        setQuery('');
                        setStatus('all');
                    }}
                />
            ) : (
                <>
                    {modules.length > 0 ? (
                        <section className="flex flex-col gap-8">
                            <GroupHeader
                                title="The modules you pay for"
                                lede="Each one is a full product, priced flat, switched on and off whenever the business changes. Turn one off and it stops billing the same day — your records stay put."
                            />
                            {/* Multi-column, not grid — a mosaic that packs.
                  These cards range from 5 capabilities (AI) to 40 (Commerce), and
                  a 2-up grid has to reconcile that in one of two bad ways: stretch
                  every card to its row's tallest and leave 150px of empty white
                  under the short one, or let them be content-height and leave the
                  same hole as a ragged step. CSS columns has no rows to reconcile
                  — each card drops into whichever column is currently shorter, so
                  the gaps close themselves at every viewport width with no
                  measuring, no JS, and no per-card span to maintain.
                  `break-inside-avoid` is what keeps a card whole; the vertical
                  rhythm is the cards' own `mb-*`, since `gap` on a multi-column
                  container only sets the COLUMN gap — and no `-mb-*` is needed to
                  cancel the last card's, because a multicol container's height
                  already excludes its last child's bottom margin (adding one ate
                  the platform panel's padding down to 1px). */}
                            <div className="columns-1 gap-5 lg:columns-2">
                                {modules.map((g) => (
                                    <ModuleCard
                                        key={g.area.id}
                                        group={g}
                                        price={prices[g.area.id]}
                                        filtered={filtered}
                                    />
                                ))}
                            </div>
                        </section>
                    ) : null}

                    {platform.length > 0 ? (
                        <section className="flex flex-col gap-8">
                            <GroupHeader
                                title="The part you never pay for"
                                lede="Search, security, domains, automation, analytics — the foundation every module is built on. There is no plan that leaves these out and no upgrade that adds them."
                            />
                            <div className="border-base-300 bg-base-100 rounded-4xl border p-8 sm:p-10">
                                {/* Same mosaic as the modules above, for the same reason —
                    Auth & Security carries ten capabilities and Legal & Consent
                    six, so a 3-up grid stepped every row. */}
                                <div className="columns-1 gap-x-10 sm:columns-2 lg:columns-3">
                                    {platform.map((g) => (
                                        <PlatformArea key={g.area.id} group={g} filtered={filtered} />
                                    ))}
                                </div>
                            </div>
                        </section>
                    ) : null}
                </>
            )}
        </div>
    );
}

function GroupHeader({ title, lede }: { title: string; lede: string }) {
    return (
        <div className="flex flex-col gap-4">
            <Heading level={2} size="display" className="text-5xl tracking-tight sm:text-6xl">
                {title}
                <span className="text-primary">.</span>
            </Heading>
            <Text variant="lead" className="max-w-3xl">
                {lede}
            </Text>
        </div>
    );
}

function ModuleCard({
    group,
    price,
    filtered,
}: {
    group: Group;
    price?: string;
    filtered: boolean;
}) {
    const { area, caps } = group;
    const href = MODULE_HREF[area.id];
    return (
        <article
            id={area.id}
            // `break-inside-avoid` makes the card atomic so the mosaic never splits one
            // across a column boundary; `mb-5` is the vertical rhythm, because a
            // multi-column container's `gap` is the column gap only. No `h-full` — the
            // whole point of the mosaic is that a card ends where its content ends.
            className="border-base-300 bg-base-100 mb-5 flex scroll-mt-40 break-inside-avoid flex-col overflow-hidden rounded-4xl border"
        >
            {/* The module's hue lives HERE — a filled header, not a tinted card and
          not colored text. Both of those were measured and both failed: a
          `bg-soft` wash per card is the pastel wall this page is replacing, and
          the name set in `text-module-*` runs 2.15:1 (Inventory) to 2.49:1 (CMS)
          on white, because these hues are fill colors that were never legible
          as ink. Filling a shape and writing in the paired `-content` is the one
          way to show a hue at size and still be readable — so the header is the
          strongest hue moment on the page AND the most legible thing on the card. */}
            <div
                className={cx(
                    'flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-8 py-5',
                    area.fill,
                    area.content
                )}
            >
                <Heading level={3} size={3} className="tracking-tight">
                    {area.name}
                </Heading>
                {price ? <span className="text-xl font-medium">{price}</span> : null}
            </div>

            <div className="flex flex-col gap-5 p-8">
                <Text className="text-lg">{area.summary}</Text>

                {filtered ? <MatchCount group={group} /> : null}

                <CapabilityList caps={caps} />

                {href ? (
                    <a href={href} className="text-md text-primary pt-2 font-medium">
                        {/* One template literal rather than `How {area.name} works` — written
                as JSX children, the text node AFTER the expression lost its
                leading space and every card rendered "How Builderworks →". */}
                        {`How ${area.name} works `}&rarr;
                    </a>
                ) : null}
            </div>
        </article>
    );
}

function PlatformArea({ group, filtered }: { group: Group; filtered: boolean }) {
    const { area, caps } = group;
    return (
        <div id={area.id} className="mb-10 flex scroll-mt-40 break-inside-avoid flex-col gap-3">
            {/* Quieter than a module card by design — these are the free foundation,
          the secondary tier of the page. The hue rides a filled marker, which is
          a SHAPE and therefore legible at any hue; the name takes the surface's
          own ink. A wall of filled headers inside one panel would out-shout the
          fourteen modules a reader is actually choosing between. */}
            <div className="flex items-center gap-2.5">
                <span className={cx('h-2.5 w-2.5 shrink-0 rounded-full', area.fill)} aria-hidden />
                <Heading level={3} size={5} className="tracking-tight">
                    {area.name}
                </Heading>
            </div>
            <Text className="text-md">{area.summary}</Text>
            {filtered ? <MatchCount group={group} /> : null}
            <CapabilityList caps={caps} single />
        </div>
    );
}

/**
 * The list itself. Two CSS columns on a module card (its items are short and the
 * card is wide); one inside a platform area, which is already a grid cell.
 * `break-inside-avoid` keeps an item from splitting across the column gap.
 */
function CapabilityList({ caps, single }: { caps: Capability[]; single?: boolean }) {
    return (
        <ul className={cx('gap-x-8', single ? 'columns-1' : 'columns-1 sm:columns-2')}>
            {caps.map((cap) => (
                <li key={cap.name} className="text-md mb-2 flex break-inside-avoid items-baseline gap-2">
                    <span>{cap.name}</span>
                    {cap.status === 'live' ? null : (
                        <Badge color={STATUS_META[cap.status].color} variant="solid" size="sm">
                            {STATUS_META[cap.status].short}
                        </Badge>
                    )}
                </li>
            ))}
        </ul>
    );
}

function EmptyState({ query, onClear }: { query: string; onClear: () => void }) {
    return (
        <div className="border-base-300 bg-base-100 flex flex-col items-start gap-5 rounded-4xl border p-10">
            <Heading level={2} size={3} className="tracking-tight">
                Nothing here matches &ldquo;{query}&rdquo;
            </Heading>
            <Text variant="lead" className="max-w-2xl">
                Try the plainest word for the job — &ldquo;booking&rdquo;, &ldquo;invoice&rdquo;,
                &ldquo;refund&rdquo;, &ldquo;newsletter&rdquo;. If it genuinely is not here, tell us and we
                will say honestly whether it is coming.
            </Text>
            <div className="flex flex-wrap gap-3">
                <Button color="primary" onClick={onClear}>
                    Show everything
                </Button>
                <a href="/contact" className="text-md text-primary self-center font-medium">
                    Ask us about it &rarr;
                </a>
            </div>
        </div>
    );
}
