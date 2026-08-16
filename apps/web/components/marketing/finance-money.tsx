import type { ReactNode } from 'react';
import { Badge, Heading, Text } from '@wizeworks/silicaui-react';
import { getModuleColor } from './primitives';

/**
 * The shared money vocabulary for /finance — the small pieces every device
 * section on the page renders, defined once.
 *
 * THE THREE COST HUES ARE THE PRODUCT'S, NOT THE PAGE'S. `costTone` mirrors
 * `kindColor` in [apps/workbench/surfaces/finance/format.ts] exactly: cost of the
 * work is `warning`, wages are `info`, running costs borrow `module-chat`
 * (violet). The workbench file carries the reasoning — `success` collides with
 * the Finance module green, `error` means broken rather than expensive,
 * `primary` is the affirmative action, and `secondary`/`accent` collapse into
 * `info` in dark mode, so the third hue has to be borrowed. What matters here is
 * that a visitor who signs up meets the SAME three colors on the real screen
 * they just saw on the marketing page. Two vocabularies for one idea is how a
 * product stops looking like the thing that was advertised.
 *
 * `netTone` is the other half of that: a month that lost money reads red before
 * anyone parses a minus sign. Color carries the sign; the sign is the backup.
 */
export const M = getModuleColor('finance');

/** The three kinds a cost rolls up under, in the owner's words — not an
 *  accountant's. "Cost of Goods Sold" is a line on a tax form; "cost of the
 *  work" is what a person actually calls it. */
export type CostKind = 'work' | 'wages' | 'running';

const COST_TONE: Record<CostKind, string> = {
    work: 'text-warning',
    wages: 'text-info',
    running: 'text-module-chat',
};

const COST_FILL: Record<CostKind, string> = {
    work: 'bg-warning',
    wages: 'bg-info',
    running: 'bg-module-chat',
};

export function costTone(kind: CostKind): string {
    return COST_TONE[kind];
}

export function costFill(kind: CostKind): string {
    return COST_FILL[kind];
}

/** Positive is Finance's own green; negative is `error`. Both are real ink
 *  tokens, so both flip correctly inside a `data-theme="dark"` island. */
export function netTone(negative: boolean): string {
    return negative ? 'text-error' : 'text-success';
}

/**
 * One line of a money breakdown: a label, an optional color swatch naming which
 * kind of cost it is, and the figure right-aligned so a column of them reads as
 * a column.
 *
 * `tabular-nums` is the one typographic detail that matters here. Without it the
 * digits are proportionally spaced and a stacked column of amounts fails to line
 * up on the decimal — which on a page about money reads as sloppiness about
 * exactly the thing being sold.
 */
export function MoneyRow({
    label,
    value,
    kind,
    emphasis,
    tone,
}: {
    label: ReactNode;
    value: string;
    /** Renders the kind's color swatch and tints the figure. */
    kind?: CostKind;
    /** The netted line — bigger, and it owns the row. */
    emphasis?: boolean;
    /** Override the figure's ink (the net line, which is green or red by sign). */
    tone?: string;
}) {
    const figureTone = tone ?? (kind ? costTone(kind) : undefined);
    return (
        <div className="flex items-baseline justify-between gap-6 py-2.5">
            <span className="flex min-w-0 items-center gap-2.5">
                {kind ? (
                    <span className={`${costFill(kind)} h-2.5 w-2.5 shrink-0 rounded-full`} aria-hidden />
                ) : null}
                {emphasis ? (
                    <Heading level={3} size={4}>
                        {label}
                    </Heading>
                ) : (
                    <Text as="span">{label}</Text>
                )}
            </span>
            <span
                className={[
                    'shrink-0 font-medium tabular-nums',
                    emphasis ? 'text-2xl' : 'text-md',
                    figureTone ?? '',
                ]
                    .filter(Boolean)
                    .join(' ')}
            >
                {value}
            </span>
        </div>
    );
}

/**
 * A margin figure as a badge — the one number on the jobs list a reader scans
 * for, so it is a signal and therefore SOLID (silica's own default; see
 * SILICA-VOCABULARY.md, "`soft` is an option, not the default").
 *
 * `success`/`error` rather than the module hue: this is state on a thing — did
 * this job make money — which is its own color axis and never module identity.
 */
export function MarginBadge({ rate, negative }: { rate: string; negative: boolean }) {
    return (
        <Badge color={negative ? 'error' : 'success'} size="sm" className="shrink-0 tabular-nums">
            {rate}
        </Badge>
    );
}

/**
 * The legend that teaches the three cost hues, used under the breakdown devices.
 *
 * It exists because the colors do real work on this page — every subsequent
 * figure is tinted by kind — and a reader who has not been told what violet
 * means is decoding rather than reading. Naming them once, early, is what lets
 * every later section drop the words and keep the color.
 */
export function CostLegend() {
    const kinds: { kind: CostKind; label: string; example: string }[] = [
        { kind: 'work', label: 'Cost of the work', example: 'parts, materials, a subcontractor' },
        { kind: 'wages', label: 'Wages', example: 'the hours that went into it' },
        { kind: 'running', label: 'Running costs', example: 'rent, fuel, software, insurance' },
    ];
    return (
        <ul className="flex list-none flex-col gap-3 p-0 sm:flex-row sm:flex-wrap sm:gap-x-8">
            {kinds.map((k) => (
                <li key={k.kind} className="flex items-baseline gap-2.5">
                    <span
                        className={`${costFill(k.kind)} relative top-[3px] h-2.5 w-2.5 shrink-0 rounded-full`}
                        aria-hidden
                    />
                    <Text as="span">
                        <span className="font-medium">{k.label}</span> — {k.example}
                    </Text>
                </li>
            ))}
        </ul>
    );
}
