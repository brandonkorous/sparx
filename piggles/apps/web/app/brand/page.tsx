import type { Metadata } from 'next';
import { Badge, Button, Card, CardBody, CardTitle } from '@wizeworks/silicaui-react';
import { PIGGLES_GROUPS, GROUP_HEX, type PigglesGroup } from '@piggles/brand';
import { appsInGroup, PRODUCT } from '@piggles/config';

// The Piggles theme, rendered.
//
// Every value in @piggles/brand was chosen by measurement — WCAG contrast plus a
// ΔE76 separation screen — and until this page existed none of it had been
// through a browser. This is where a token stops being a number in a comment.
//
// Light and dark render SIDE BY SIDE as nested `data-theme` islands rather than
// behind a toggle. silicaui scopes themes to the DOM, so this is the supported
// idiom, and comparing the two is the whole job of a reference page: a value that
// passes in one mode and fails in the other is exactly what a toggle hides.
//
// EVERY silica class below is a LITERAL string. Tailwind v4 emits only what it
// can scan in source, so a computed `bg-${token}` generates nothing and renders
// unstyled — the classes are spelled out in these tables for that reason, not
// out of verbosity.

export const metadata: Metadata = { title: 'Brand' };

const MODES = [
    { theme: 'light', label: 'Light' },
    { theme: 'dark', label: 'Dark' },
] as const;

/** Ratios are measured against each token's own `-content` ink, and are STATED
 *  rather than computed — the page is a record of the decision, not a live
 *  recalculation that would quietly agree with itself if a token were changed by
 *  mistake. */
const BRAND_ROLES = [
    {
        token: 'primary',
        fill: 'bg-primary text-primary-content',
        note: 'Piggles Pink — takes dark ink; white measures 2.44',
        ratio: '5.69',
    },
    {
        token: 'secondary',
        fill: 'bg-secondary text-secondary-content',
        note: 'Deep charcoal — the wordmark color',
        ratio: '12.47',
    },
    {
        token: 'accent',
        fill: 'bg-accent text-accent-content',
        note: 'Soft supporting pink, deliberately low-emphasis',
        ratio: '9.01',
    },
    {
        token: 'neutral',
        fill: 'bg-neutral text-neutral-content',
        note: 'Warm plum-grey — a different ROLE from secondary',
        ratio: '9.04',
    },
] as const;

const SEMANTIC_ROLES = [
    { token: 'success', fill: 'bg-success text-success-content', note: 'Completed, healthy, paid' },
    { token: 'info', fill: 'bg-info text-info-content', note: 'Neutral information' },
    {
        token: 'warning',
        fill: 'bg-warning text-warning-content',
        note: 'Needs attention, not yet wrong',
    },
    { token: 'error', fill: 'bg-error text-error-content', note: 'Wrong or failed' },
    {
        token: 'danger',
        fill: 'bg-danger text-danger-content',
        note: 'Destructive — what statusTone() returns',
    },
] as const;

const SURFACES = [
    { token: 'base-100', fill: 'bg-base-100', role: 'Top surface — cards, dialogs, windows' },
    { token: 'base-200', fill: 'bg-base-200', role: 'The canvas everything sits on' },
    { token: 'base-300', fill: 'bg-base-300', role: 'Deepest recess, strongest separation' },
] as const;

function Swatch({
    token,
    fill,
    note,
    ratio,
}: {
    token: string;
    fill: string;
    note: string;
    ratio?: string;
}) {
    return (
        <div className="flex items-center gap-3">
            <div
                className={`${fill} rounded-box flex h-16 w-24 shrink-0 items-center justify-center text-sm font-semibold`}
            >
                Aa
            </div>
            <div className="min-w-0">
                <p className="font-mono text-sm font-semibold">--color-{token}</p>
                <p className="text-sm">{note}</p>
                {ratio ? <p className="font-mono text-sm">{ratio}:1 on its own ink</p> : null}
            </div>
        </div>
    );
}

function GroupBlock({ group }: { group: PigglesGroup }) {
    const apps = appsInGroup(group);
    // `home` aliases the brand pink, so it has no fixed hex — it follows primary
    // into dark mode. Every other group is theme-independent.
    const hex = group === 'home' ? 'var(--color-primary)' : GROUP_HEX[group];

    return (
        // `data-group` repoints --color-module for this subtree, which is what lets
        // everything inside use `module` and land on the right hue with no color
        // named at the call site. That indirection IS the design system working.
        <div className="bg-base-100 rounded-box border-base-300 border p-4" data-group={group}>
            <div className="mb-3 flex items-center gap-3">
                <div className="bg-module text-module-content rounded-selector px-3 py-1 text-sm font-semibold capitalize">
                    {group}
                </div>
                <span className="font-mono text-sm">{hex}</span>
            </div>
            <ul className="flex flex-wrap gap-2">
                {apps.map((app) => (
                    <li key={app.id}>
                        <Badge color="module" variant="soft" size="lg">
                            {app.label}
                        </Badge>
                    </li>
                ))}
            </ul>
        </div>
    );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section className="mb-10">
            <h3 className="mb-4 text-xl font-bold">{title}</h3>
            {children}
        </section>
    );
}

function ThemePanel({ theme, label }: { theme: string; label: string }) {
    return (
        <div data-theme={theme} className="bg-base-200 text-base-content rounded-box p-6">
            <h2 className="mb-8 text-2xl font-extrabold">{label}</h2>

            <Section title="Brand">
                <div className="grid gap-4 sm:grid-cols-2">
                    {BRAND_ROLES.map((r) => (
                        <Swatch key={r.token} token={r.token} fill={r.fill} note={r.note} ratio={r.ratio} />
                    ))}
                </div>
            </Section>

            <Section title="Semantic">
                <div className="grid gap-4 sm:grid-cols-2">
                    {SEMANTIC_ROLES.map((r) => (
                        <Swatch key={r.token} token={r.token} fill={r.fill} note={r.note} />
                    ))}
                </div>
            </Section>

            <Section title="Surfaces">
                <div className="grid gap-3 sm:grid-cols-3">
                    {SURFACES.map((s) => (
                        <div key={s.token} className={`${s.fill} rounded-box border-base-300 border p-4`}>
                            <p className="font-mono text-sm font-semibold">--color-{s.token}</p>
                            <p className="text-sm">{s.role}</p>
                        </div>
                    ))}
                </div>
                <p className="mt-3 text-sm">
                    base-100 is the lightest of the three in <em>both</em> themes — raised surfaces catch more
                    light.
                </p>
            </Section>

            <Section title="App groups">
                <div className="grid gap-3 sm:grid-cols-2">
                    {PIGGLES_GROUPS.map((g) => (
                        <GroupBlock key={g} group={g} />
                    ))}
                </div>
                <p className="mt-3 text-sm">
                    Five hues plus the brand cover all fifteen apps. Apps inside a group separate by icon and
                    label, never by hue.
                </p>
            </Section>

            <Section title="Controls">
                <div className="mb-4 flex flex-wrap items-center gap-2">
                    <Button color="primary">Primary</Button>
                    <Button color="secondary">Secondary</Button>
                    <Button color="accent">Accent</Button>
                    <Button color="neutral" variant="outline">
                        Outline
                    </Button>
                    <Button color="neutral" variant="ghost">
                        Ghost
                    </Button>
                    <Button color="danger">Delete</Button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {SEMANTIC_ROLES.map((r) => (
                        <Badge key={r.token} color={r.token} variant="soft" size="lg">
                            {r.token}
                        </Badge>
                    ))}
                </div>
                <p className="mt-3 text-sm">
                    The Delete button and the brand pink must never read as the same color — the reason dark{' '}
                    <code>error</code> is a red rather than another rose.
                </p>
            </Section>

            <Section title="Shape and depth">
                <div className="grid gap-4 sm:grid-cols-2">
                    <Card>
                        <CardBody>
                            <CardTitle>18px corners, depth 1</CardTitle>
                            <p>
                                Cards round with <code>--radius-box</code> and lift with <code>--depth</code>. sparx
                                runs 8px and depth 0; that difference is most of why these two products do not look
                                alike.
                            </p>
                        </CardBody>
                    </Card>
                    <Card>
                        <CardBody>
                            <CardTitle>Fields are 12px</CardTitle>
                            <p>
                                Buttons and inputs share the field tier, so they line up and round together. The
                                mark is a squircle — if the UI runs sharp, the logo looks borrowed.
                            </p>
                        </CardBody>
                    </Card>
                </div>
            </Section>
        </div>
    );
}

export default function BrandPage() {
    return (
        <main className="mx-auto max-w-7xl px-6 py-12">
            <h1 className="text-4xl font-extrabold">{PRODUCT.name}</h1>
            <p className="mt-2 text-lg">{PRODUCT.tagline}</p>
            <p className="mt-6 max-w-2xl">
                The living reference for the Piggles theme. Every value here was chosen by measurement
                rather than by eye; this page is where those numbers meet a browser. Both themes render at
                once, because a token that passes in one mode and fails in the other is exactly what a
                toggle hides.
            </p>

            <div className="mt-10 grid gap-6 lg:grid-cols-2">
                {MODES.map((m) => (
                    <ThemePanel key={m.theme} theme={m.theme} label={m.label} />
                ))}
            </div>
        </main>
    );
}
