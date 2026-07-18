'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { ArrowLeft, Check } from 'lucide-react';
import { cn } from '../../utils/cn';
import { Button } from '../primitives/button';
import { Heading } from '../primitives/heading';
import { Text } from '../primitives/text';
import { RAIL_BG, RailWordmark } from '../brand/brand-rail';

// SurfaceFrame — the platform's one layout language for FORM SURFACES, create &
// edit alike (docs/86). Single-step by default; the `steps`/stepper machinery is
// an opt-in feature for multi-step flows (a wizard), never the identity — pass a
// single step and the progress UI hides itself. There are TWO presentations of
// the same model:
//
//   1. The IN-APP TOP STEPPER (default for every dashboard form surface). A light,
//      module-tinted horizontal stepper above a working pane, on the dashboard's
//      normal surface language. It sits INSIDE the app chrome rather than taking
//      it over, so "full page" keeps the sidebar + header and a drawer/modal
//      hosts the very same frame:
//        • variant="embedded" — in-flow, fills the dashboard content area. The
//                               full-page `/new` create routes (Product, Customer,
//                               B2B, Document, …) — picked by `defaultDetailView`.
//        • variant="inline"   — fills a host overlay that supplies its own chrome
//                               (the drawer/modal detail panel). The user's
//                               `defaultDetailView` chooses drawer vs. modal.
//        • variant="modal"    — the same frame inside a self-owned Radix dialog
//                               (e.g. the new-site wizard).
//      All three collapse the stepper to a compact "Step n of N" line below the
//      narrow breakpoint (top-2 rule, docs/86).
//
//   2. The IMMERSIVE RAIL — variant="page". A full-bleed two-pane frame with a
//      flat module-colored left RAIL (brand + vertical journey + per-step lede),
//      owning the whole viewport. Reserved for FIRST-RUN onboarding / blueprint
//      install, where there's no app chrome yet and the branded moment fits. The
//      rail is a FLAT SOLID fill of the active module color (no gradient — sparx
//      is flat), driven by the wrapping <ModuleProvider> via `--module-active`.
//
// This file owns the LAYOUT only. The flow inside it (which steps, which fields,
// validation) is owned by the feature: onboarding by docs/15, the create-wizards
// by docs/68.

// ── Public types ─────────────────────────────────────────────────────────────

export interface SurfaceStepDef {
    /** Stable key for this step (matches the consumer's step machine). */
    key: string;
    /** Journey label, e.g. "Modules". */
    label: string;
    /** A one-line sublabel under the label, e.g. "What you need". */
    sublabel?: string;
}

export type SurfaceVariant = 'page' | 'modal' | 'inline' | 'embedded';

export interface SurfaceFrameProps {
    variant?: SurfaceVariant;
    /** Page variant: the brand node at the rail top. Defaults to the inverted
     *  sparx wordmark (white "Spar" + a light tint of the module color "x"). */
    wordmark?: React.ReactNode;
    /** Top-stepper variants: the wizard's title at the header left, e.g. "New
     *  product". (Page variant uses `lede` instead.) */
    title?: React.ReactNode;
    /** `embedded` variant only: renders a real "← {backLabel}" link at the far
     *  left of the frame's toolbar (e.g. "Products"), replacing the plain Cancel
     *  button — one leave-affordance, not two. Reuses `onCancel` as the guarded
     *  leave handler (same discard confirm). `inline` has no list to go back to
     *  (the overlay host's Close already serves that role) and `modal`/`page`
     *  don't take one. Omit to keep the plain Cancel button. */
    backLabel?: string;
    /** Page variant lede under the brand — a headline + supporting blurb that the
     *  consumer changes per step to narrate the journey. */
    lede?: { title: React.ReactNode; blurb?: React.ReactNode };
    /** The full journey. Order is the source of truth for done/current/upcoming. */
    steps: SurfaceStepDef[];
    /** Zero-based index of the current step. */
    current: number;
    /** A one-line context note. Page variant pins it to the rail bottom; the
     *  top-stepper variants show it as a muted hint under the stepper. */
    context?: React.ReactNode;
    /** Jump to a visited step from the journey. */
    onStepSelect?: (key: string, index: number) => void;
    /** Whether a journey row is clickable. Default: any step at/at-or-before the
     *  current one (you can't skip ahead by clicking). */
    canSelectStep?: (key: string, index: number) => boolean;
    /** Header/rail utility slot. Page variant: rail links (Save & exit / Need help)
     *  pinned to the rail bottom. Modal variant: header-right content. NOTE: the F
     *  variants (inline/embedded) do NOT use this for Cancel — pass `onCancel`, which
     *  the frame renders as a real ghost Button in the top toolbar. */
    footer?: React.ReactNode;
    /** The leave/cancel action for the in-app variants. The frame renders it as a
     *  ghost Cancel Button (or, on `embedded` with `backLabel` set, a "← Back"
     *  link) so it always matches Back/Next — in the F variants' top toolbar.
     *  Never hand-roll a cancel <button> at the call site (that drift is exactly
     *  what stranded the old styling — docs/86). */
    onCancel?: () => void;
    /** Label for the frame-owned Cancel button. Defaults to "Cancel". */
    cancelLabel?: ResponsiveLabel;
    /** F variants (inline/embedded): a live "draft summary" tree (compose with
     *  SurfaceSummary / SurfaceSummaryRow). Renders as the right-hand column when the
     *  frame is wide and stacks as a card after the fields when narrow. Omit for
     *  wizards without a natural summary — the form then fills the full width. */
    summary?: React.ReactNode;
    /** `embedded` variant only: right-aligned actions in the title strip — e.g. a
     *  presentation switch (open this record as a drawer/modal). `inline` ignores it
     *  because the drawer/modal HOST chrome already owns the window controls; the
     *  embedded full-page surface has no host, so it carries them here for parity. */
    headerActions?: React.ReactNode;
    /** `inline` variant only: an externally-supplied DOM node — typically the
     *  drawer/modal HOST chrome's own action slot (e.g. the dashboard's
     *  `DetailFooterSlotTarget`) — that the active step's action row portals
     *  into instead of the frame rendering its own toolbar bar underneath the
     *  host's. Merges into the ONE existing toolbar rather than stacking a
     *  second one (the host already shows title + window controls). Pass `null`
     *  while the host hasn't mounted its target yet — the row simply doesn't
     *  render until it has, same as `null` behaves for `DetailFooterSlot`. Omit
     *  entirely to keep the frame's self-contained toolbar row (the default —
     *  every consumer without a host chrome to merge into, e.g. Quote/Order). */
    actionsTarget?: HTMLElement | null;
    className?: string;
    children: React.ReactNode;

    // ── Modal-only ──────────────────────────────────────────────────────────────
    /** Controlled open state (modal variant). */
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    /** Guard backdrop-click / Esc dismissal. Return `false` to block the close
     *  (wire this to a destructive-action confirm so progress is never lost). */
    onRequestClose?: () => boolean | void;
}

interface SurfaceContextValue {
    variant: SurfaceVariant;
    /** F variants (inline/embedded): the leave action. The frame renders it as a
     *  ghost Cancel Button in the top toolbar (matching Back) — never raw JSX. */
    onCancel?: () => void;
    /** Label for the frame-owned Cancel button (default "Cancel"). */
    cancelLabel?: ResponsiveLabel;
    /** F variants: the live summary content. Rendered as the right-hand column when
     *  the frame is wide enough (container query) and stacked as a card after the
     *  fields when it's narrow (the drawer). */
    summary?: React.ReactNode;
}

const SurfaceContext = React.createContext<SurfaceContextValue>({ variant: 'page' });

// ── Action-slot portal (frame toolbar ⇄ SurfaceStep) ───────────────────────
// SurfaceStep owns the active step's `actions` (Cancel/Back/Skip/primary — they
// vary per step), but the toolbar now lives in the FRAME's own header row, a
// sibling the step can't reach by props alone. Same two-context portal shape as
// the dashboard's DetailHeaderSlot/DetailFooterSlot: the frame renders a target
// in its toolbar; the step portals its ActionRow into it. Scoped to this file —
// `@sparx/ui` stays framework/app-agnostic, no dependency on dashboard code.
const ActionSlotSetContext = React.createContext<((node: HTMLElement | null) => void) | null>(null);
const ActionSlotNodeContext = React.createContext<HTMLElement | null>(null);

function ActionSlotProvider({ children }: { children: React.ReactNode }) {
    const [node, setNode] = React.useState<HTMLElement | null>(null);
    return (
        <ActionSlotSetContext.Provider value={setNode}>
            <ActionSlotNodeContext.Provider value={node}>{children}</ActionSlotNodeContext.Provider>
        </ActionSlotSetContext.Provider>
    );
}

function ActionSlotTarget({ className }: { className?: string }) {
    const setNode = React.useContext(ActionSlotSetContext);
    const ref = React.useCallback((el: HTMLElement | null) => setNode?.(el), [setNode]);
    return <div ref={ref} className={className} />;
}

// Overrides the internal action-slot target with a HOST-supplied one (see
// `SurfaceFrameProps.actionsTarget`). `undefined` (the default) means "no
// override, use the frame's own toolbar"; `null` means "overridden, but the
// host hasn't mounted its target yet."
const ExternalActionsTargetContext = React.createContext<HTMLElement | null | undefined>(undefined);

// The F layout is responsive by CONTAINER width, not viewport: at/above ~720px
// the frame is two columns (form + summary aside); below it collapses to one and
// the summary stacks as a card after the fields. The `@container` lives on the
// frame root and the `@[720px]:` variants below read it — so a narrow drawer
// stacks even on a wide screen (docs/86). The classes are written as full
// literals (never concatenated) so Tailwind's scanner generates them.
//
// A soft module tint over the surface — the quiet summary panel background. On a
// form the field cards go neutral, so this rail is the single module cue; it uses
// the standard 12% card-tint level (matching Card variant="module") so the lone
// tinted element reads consistently with module tints elsewhere.
const SUMMARY_BG = 'bg-primary';

// ── Rail (immersive `page` variant) ────────────────────────────────────────────
// RAIL_BG + RailWordmark are shared with the auth split-panel via ../brand/brand-rail
// so the colored rail has one source of truth across guided surfaces.

interface RailProps {
    compact?: boolean;
    brand: React.ReactNode;
    lede?: SurfaceFrameProps['lede'];
    steps: SurfaceStepDef[];
    current: number;
    context?: React.ReactNode;
    onStepSelect?: SurfaceFrameProps['onStepSelect'];
    canSelectStep: (key: string, index: number) => boolean;
    footer?: React.ReactNode;
    className?: string;
}

function Rail({
    compact = false,
    brand,
    lede,
    steps,
    current,
    context,
    onStepSelect,
    canSelectStep,
    footer,
    className,
}: RailProps) {
    return (
        <aside
            style={{ background: RAIL_BG, color: '#fff' }}
            className={cn(
                // h-full so the rail fills its (stretched) grid cell even when its own
                // content is short — the colored rail must run the full viewport height.
                'flex h-full flex-col overflow-y-auto',
                compact ? 'px-6 py-7' : 'px-8 py-9',
                className
            )}
        >
            <div className="shrink-0">{brand}</div>

            {lede && !compact && (
                <div className="mt-8">
                    <p className="text-[1.55rem] leading-tight font-medium tracking-tight text-white">
                        {lede.title}
                    </p>
                    {lede.blurb && (
                        <p className="mt-2 max-w-[24ch] text-sm leading-relaxed text-white/65">{lede.blurb}</p>
                    )}
                </div>
            )}

            <nav aria-label="Progress" className={cn(compact ? 'mt-6' : 'mt-8')}>
                <ol className="flex flex-col">
                    {steps.map((step, idx) => {
                        const status: 'done' | 'current' | 'upcoming' =
                            idx < current ? 'done' : idx === current ? 'current' : 'upcoming';
                        const selectable = canSelectStep(step.key, idx);
                        const isLast = idx === steps.length - 1;

                        return (
                            <li key={step.key} className="relative">
                                <button
                                    type="button"
                                    disabled={!selectable}
                                    aria-current={status === 'current' ? 'step' : undefined}
                                    onClick={selectable ? () => onStepSelect?.(step.key, idx) : undefined}
                                    className={cn(
                                        'grid w-full grid-cols-[30px_1fr] items-start gap-3 py-2 text-left',
                                        selectable ? 'cursor-pointer' : 'cursor-default'
                                    )}
                                >
                                    {/* Marker + connector. Bespoke rail chrome on a colored surface
                      (not a re-skinned control) — white/translucent by design. */}
                                    <span className="relative flex justify-center">
                                        <span
                                            aria-hidden
                                            className={cn(
                                                'flex h-[30px] w-[30px] items-center justify-center rounded-full border text-[13px] font-medium transition-colors duration-200',
                                                status === 'upcoming' && 'border-white/30 text-white/55',
                                                status === 'done' && 'border-transparent bg-white/20 text-white',
                                                status === 'current' &&
                                                'border-white bg-white text-[color-mix(in_oklab,var(--color-module)_70%,#000)] ring-4 ring-white/15'
                                            )}
                                        >
                                            {status === 'done' ? <Check className="h-4 w-4" /> : idx + 1}
                                        </span>
                                        {!isLast && (
                                            <span
                                                aria-hidden
                                                className="absolute top-[34px] h-[calc(100%-22px)] w-px bg-white/20"
                                            />
                                        )}
                                    </span>
                                    <span className="min-w-0 pt-1">
                                        <span
                                            className={cn(
                                                'block text-sm leading-tight font-medium transition-colors duration-200',
                                                status === 'current'
                                                    ? 'text-white'
                                                    : status === 'done'
                                                        ? 'text-white/85'
                                                        : 'text-white/55'
                                            )}
                                        >
                                            {step.label}
                                        </span>
                                        {step.sublabel && (
                                            <span className="mt-0.5 block text-xs text-white/45">{step.sublabel}</span>
                                        )}
                                    </span>
                                </button>
                            </li>
                        );
                    })}
                </ol>
            </nav>

            <div className="mt-auto flex flex-col gap-4 pt-8">
                {context && (
                    <div className="rounded-xl border border-white/12 bg-white/8 px-4 py-3">
                        <p className="text-[0.78rem] leading-relaxed text-white/80">{context}</p>
                    </div>
                )}
                {footer && (
                    <div className="flex items-center justify-between text-[0.78rem] text-white/60">
                        {footer}
                    </div>
                )}
            </div>
        </aside>
    );
}

// The slim mobile top bar the rail collapses to below 940px (top-2 rule, docs/86).
function RailTopBar({
    brand,
    steps,
    current,
    className,
}: {
    brand: React.ReactNode;
    steps: SurfaceStepDef[];
    current: number;
    className?: string;
}) {
    return (
        <div
            style={{ background: RAIL_BG }}
            className={cn('sticky top-0 z-10 flex items-center gap-3 px-5 py-3.5 text-white', className)}
        >
            {brand}
            <span className="ml-auto flex items-center gap-1.5" aria-hidden>
                {steps.map((step, idx) => (
                    <span
                        key={step.key}
                        className={cn(
                            'h-2 rounded-full transition-all duration-200',
                            idx === current ? 'w-5 bg-white' : 'w-2 bg-white/35'
                        )}
                    />
                ))}
            </span>
            <span className="sr-only">
                Step {current + 1} of {steps.length}
            </span>
        </div>
    );
}

// ── Top stepper (in-app variants) ──────────────────────────────────────────────
// The horizontal progress stepper that replaces the dark rail for in-app wizards.
// Light surface, module-tinted markers — it lives inside the dashboard chrome
// (embedded), the drawer/modal detail panel (inline), or a dialog (modal), and
// never competes with the app's own nav. Connectors are drawn behind the markers
// as half-segments per step so the layout stays fluid at any step count / width.

interface TopStepperProps {
    steps: SurfaceStepDef[];
    current: number;
    onStepSelect?: SurfaceFrameProps['onStepSelect'];
    canSelectStep: (key: string, index: number) => boolean;
}

function TopStepper({ steps, current, onStepSelect, canSelectStep }: TopStepperProps) {
    return (
        <div className="border-base-300 bg-base-100 shrink-0 border-b px-6 py-4">
            {/* Narrow viewports collapse to a single line (top-2 rule). */}
            <p className="text-base-content hidden text-center text-xs font-medium max-[680px]:block">
                Step {current + 1} of {steps.length}
                {steps[current]?.label ? ` · ${steps[current]?.label}` : ''}
            </p>
            <ol className="flex items-start max-[680px]:hidden">
                {steps.map((step, idx) => {
                    const status: 'done' | 'current' | 'upcoming' =
                        idx < current ? 'done' : idx === current ? 'current' : 'upcoming';
                    const selectable = canSelectStep(step.key, idx);
                    return (
                        <li key={step.key} className="relative flex min-w-0 flex-1 flex-col items-center">
                            {/* Connector to the previous marker, drawn behind (z-0). The segment
                  is "done" once we've reached this step. */}
                            {idx > 0 && (
                                <span
                                    aria-hidden
                                    className={cn(
                                        'absolute top-[13px] right-1/2 left-[-50%] h-0.5',
                                        idx <= current ? 'bg-module' : 'bg-base-300'
                                    )}
                                />
                            )}
                            <button
                                type="button"
                                disabled={!selectable}
                                aria-current={status === 'current' ? 'step' : undefined}
                                onClick={selectable ? () => onStepSelect?.(step.key, idx) : undefined}
                                className={cn(
                                    'relative z-10 flex flex-col items-center gap-1.5 px-2',
                                    selectable ? 'cursor-pointer' : 'cursor-default'
                                )}
                            >
                                <span
                                    aria-hidden
                                    className={cn(
                                        'flex h-7 w-7 items-center justify-center rounded-full border text-[12px] font-semibold transition-colors duration-200',
                                        status === 'upcoming' &&
                                        'text-base-content bg-base-100 border-[color-mix(in_oklab,var(--color-base-content)_30%,transparent)]',
                                        status === 'done' &&
                                        'bg-module border-transparent text-[var(--color-module-content)]',
                                        status === 'current' &&
                                        'bg-module ring-module/20 border-transparent text-[var(--color-module-content)] ring-4'
                                    )}
                                >
                                    {status === 'done' ? <Check className="h-3.5 w-3.5" /> : idx + 1}
                                </span>
                                <span
                                    className={cn(
                                        'max-w-[14ch] text-center text-[11px] leading-tight font-medium transition-colors duration-200',
                                        status === 'upcoming' ? 'text-base-content' : 'text-base-content'
                                    )}
                                >
                                    {step.label}
                                </span>
                            </button>
                        </li>
                    );
                })}
            </ol>
        </div>
    );
}

// A toolbar label that shortens on a narrow toolbar row instead of wrapping or
// crowding out its neighbors — "Create draft & continue" reads fine on a wide
// full page but has no business on a 380px drawer. Pass a plain string to opt
// out (most labels — Cancel, Back, Products — are already one word). Screen
// readers always get the FULL text via a visually-hidden span, regardless of
// which visual variant the CSS toggle is showing.
export type ResponsiveLabel = string | { full: string; short: string };

// Exported so the dashboard's own top toolbars (the drawer/modal/full-page
// detail header, which is app-level chrome outside this file) can shorten
// their portaled Save button the same way — one label-collapsing convention
// platform-wide, not a `@sparx/ui`-only trick.
export function AdaptiveLabel({ label }: { label: ResponsiveLabel }) {
    if (typeof label === 'string') return <>{label}</>;
    return (
        <>
            <span aria-hidden className="hidden @[34rem]/toolbar:inline">
                {label.full}
            </span>
            <span aria-hidden className="@[34rem]/toolbar:hidden">
                {label.short}
            </span>
            <span className="sr-only">{label.full}</span>
        </>
    );
}

// The frame's own top toolbar — back-link + title on the left, the
// presentation switch / rail footer text + the active step's portaled
// ActionRow on the right. ONE row, shared by every topStepper-family variant
// (inline, embedded, modal); which pieces populate differs by variant. Named
// `@container/toolbar` so AdaptiveLabel can react to THIS row's own width
// rather than the whole frame's (which is tuned for the wider summary-column
// breakpoint) — a narrow drawer shortens labels well before 720px.
function FrameToolbar({
    backLabel,
    onBack,
    title,
    headerActions,
    footer,
    className,
}: {
    backLabel?: string;
    onBack?: () => void;
    title?: React.ReactNode;
    headerActions?: React.ReactNode;
    footer?: React.ReactNode;
    className?: string;
}) {
    return (
        <div
            className={cn(
                'border-base-300 bg-base-100 @container/toolbar flex h-[52px] shrink-0 items-center gap-3 border-b px-6 max-[680px]:px-4',
                className
            )}
        >
            {backLabel && onBack && (
                <Button variant="ghost" size="sm" onClick={onBack} className="shrink-0">
                    <ArrowLeft className="h-4 w-4" />
                    {backLabel}
                </Button>
            )}
            {title ? (
                <span className="text-base-content min-w-0 flex-1 truncate text-sm font-semibold tracking-tight">
                    {title}
                </span>
            ) : (
                <div className="flex-1" />
            )}
            {footer && <div className="text-base-content shrink-0 text-[0.8rem]">{footer}</div>}
            {/* Zone order: Form actions (Cancel/Continue) before Presentation
          (headerActions — the drawer/modal switch) before Window — the
          rightmost, strongest control is always the one that moves forward,
          never a view-switcher (toolbar zone system). */}
            <ActionSlotTarget className="flex shrink-0 items-center" />
            {headerActions && <div className="flex shrink-0 items-center gap-1">{headerActions}</div>}
        </div>
    );
}

// The shared in-app shell: header + top stepper + working pane. Fills its host
// (h-full) — the dashboard content area (embedded), a drawer/modal body (inline),
// or a dialog (modal). The pane is `min-h-0 flex-1` so the child SurfaceStep owns
// the scroll and pins its action row to the bottom edge.
function TopStepperFrame({
    title,
    steps,
    current,
    context,
    onStepSelect,
    canSelectStep,
    footer,
    className,
    children,
}: {
    title?: React.ReactNode;
    steps: SurfaceStepDef[];
    current: number;
    context?: React.ReactNode;
    onStepSelect?: SurfaceFrameProps['onStepSelect'];
    canSelectStep: (key: string, index: number) => boolean;
    footer?: React.ReactNode;
    className?: string;
    children: React.ReactNode;
}) {
    return (
        <ActionSlotProvider>
            <div className={cn('bg-base-200 flex h-full flex-col overflow-hidden', className)}>
                <FrameToolbar title={title} footer={footer} />
                {steps.length > 1 && (
                    <TopStepper
                        steps={steps}
                        current={current}
                        onStepSelect={onStepSelect}
                        canSelectStep={canSelectStep}
                    />
                )}
                {context && (
                    <p className="text-base-content border-base-300 bg-base-200 shrink-0 border-b px-6 py-2 text-center text-xs">
                        {context}
                    </p>
                )}
                <div className="min-h-0 flex-1">{children}</div>
            </div>
        </ActionSlotProvider>
    );
}

// ── F layout (inline + embedded): form column + live summary ───────────────────
// The in-app create surface (docs/86). A top toolbar (title + back-link on
// embedded — the drawer/modal host supplies the title for inline — plus the
// active step's Cancel/Back/Skip/primary), a compact MiniProgress, the working
// pane, and a quiet module-tinted summary that fills the right column when wide
// and stacks as a card when narrow.

// The compact progress indicator: n segments filled through the current step, plus
// "<label> · step n of m". Replaces the big numbered stepper in the F layout.
function MiniProgress({
    steps,
    current,
    className,
}: {
    steps: SurfaceStepDef[];
    current: number;
    className?: string;
}) {
    return (
        <div className={cn('text-base-content flex items-center gap-1.5 text-xs', className)}>
            <span className="flex items-center gap-1" aria-hidden>
                {steps.map((step, idx) => (
                    <span
                        key={step.key}
                        className={cn(
                            'h-1 w-8 rounded-full transition-colors duration-200',
                            idx <= current
                                ? 'bg-module'
                                : 'bg-[color-mix(in_oklab,var(--color-base-content)_12%,transparent)]'
                        )}
                    />
                ))}
            </span>
            <span className="text-base-content ml-1.5 font-medium">{steps[current]?.label}</span>
            <span>
                · step {current + 1} of {steps.length}
            </span>
        </div>
    );
}

// ── Summary primitives (the live "draft summary" content) ──────────────────────
// Consumers compose these and pass the tree as SurfaceFrame's `summary` — the
// frame places it in the right column (wide) or a stacked card (narrow). Keeps
// every wizard's summary visually identical without each re-rolling the styling.

export function SurfaceSummary({
    title,
    children,
    footer,
}: {
    title: React.ReactNode;
    children: React.ReactNode;
    /** Pinned to the bottom of the column (e.g. a Draft/Published badge). */
    footer?: React.ReactNode;
}) {
    return (
        <div className="flex h-full flex-col">
            <p className="text-base-content mb-4 text-[1.0625rem] leading-tight font-medium tracking-tight">
                {title}
            </p>
            <div className="flex flex-col">{children}</div>
            {footer && <div className="mt-auto pt-5">{footer}</div>}
        </div>
    );
}

export function SurfaceSummaryRow({
    label,
    value,
    strong,
}: {
    label: React.ReactNode;
    value: React.ReactNode;
    /** The total row — heavier weight, larger size, anchors the column. */
    strong?: boolean;
}) {
    return (
        <div className="flex items-baseline justify-between gap-3 py-2">
            <span
                className={cn(
                    'text-base-content text-sm',
                    strong && 'text-base-content text-[0.9375rem] font-semibold'
                )}
            >
                {label}
            </span>
            <span
                className={cn(
                    'text-base-content text-sm tabular-nums',
                    strong && 'text-[0.9375rem] font-semibold'
                )}
            >
                {value}
            </span>
        </div>
    );
}

export function SurfaceSummaryDivider() {
    return <div className="border-base-300 my-1.5 border-t" />;
}

// The shared F frame. Its own toolbar always renders (both variants need a
// place for the ActionRow); embedded additionally shows the title + back-link +
// presentation switch — inline omits those because the host chrome above it
// already owns the title + window controls.
function FSurfaceFrame({
    variant,
    title,
    headerActions,
    backLabel,
    steps,
    current,
    summary,
    onCancel,
    cancelLabel,
    actionsTarget,
    className,
    children,
}: {
    variant: 'inline' | 'embedded';
    title?: React.ReactNode;
    headerActions?: React.ReactNode;
    backLabel?: string;
    steps: SurfaceStepDef[];
    current: number;
    summary?: React.ReactNode;
    onCancel?: () => void;
    cancelLabel?: ResponsiveLabel;
    actionsTarget?: HTMLElement | null;
    className?: string;
    children: React.ReactNode;
}) {
    const hasSummary = Boolean(summary);
    // `embedded` (full page) trades the plain Cancel button for a real "← Back"
    // link at the toolbar's far left — one leave-affordance, not two. `inline`
    // (drawer/modal) has no list to go back to (the host's Close already does
    // that), so it keeps Cancel in the ActionRow, unchanged.
    const showBackLink = variant === 'embedded' && Boolean(backLabel) && Boolean(onCancel);
    // Inline only, and only when the host opted in (prop present at all — `null`
    // still counts, it means "opted in, not mounted yet"): merge into the host's
    // existing toolbar instead of stacking a second bar underneath it.
    const mergeIntoHostChrome = variant === 'inline' && actionsTarget !== undefined;
    const inner = (
        <div
            className={cn(
                'bg-base-100 @container flex h-full min-h-0 flex-col overflow-hidden',
                // Embedded (full page) is a CONTAINED, centered sheet — never edge-to-edge.
                // Capped in width with the page showing on either side; the inline (drawer/
                // modal) host already bounds the frame, so it fills its host instead.
                variant === 'embedded' &&
                cn(
                    'border-base-300 mx-auto w-full border-x',
                    // With a summary the sheet is wide (room for form + the right column);
                    // without one it's a tight, centered form sheet so the fields don't
                    // float in a huge gutter.
                    hasSummary ? 'max-w-[1120px]' : 'max-w-[820px]'
                ),
                className
            )}
        >
            {/* The frame's own top toolbar — carries the title (embedded only; inline's
          host chrome already shows one above this), the back-link / presentation
          switch (embedded only), and the active step's portaled ActionRow. Skipped
          entirely for inline when the host supplied `actionsTarget`: the ActionRow
          portals into the HOST's own toolbar row instead (see `mergeIntoHostChrome`
          below) — one toolbar, not two. */}
            {!mergeIntoHostChrome && (
                <FrameToolbar
                    backLabel={showBackLink ? backLabel : undefined}
                    onBack={showBackLink ? onCancel : undefined}
                    title={variant === 'embedded' ? title : undefined}
                    headerActions={variant === 'embedded' ? headerActions : undefined}
                    className="px-7 max-[680px]:px-5"
                />
            )}
            <div
                className={cn(
                    'grid min-h-0 flex-1 grid-cols-1',
                    hasSummary && '@[720px]:grid-cols-[1fr_320px]'
                )}
            >
                {/* Form column: progress + working pane (SurfaceStep owns its scroll and
            portals its action toolbar up into the frame's FrameToolbar above). A
            single-step form (one step) hides MiniProgress — nothing to show. */}
                <div className="flex min-h-0 flex-col">
                    {steps.length > 1 && (
                        <div className="bg-base-200 shrink-0 px-7 pt-4 pb-1 max-[680px]:px-5">
                            <MiniProgress steps={steps} current={current} />
                        </div>
                    )}
                    <div className="flex min-h-0 flex-1 flex-col">{children}</div>
                </div>
                {/* Summary aside — full-height right column, shown only when wide. The
            narrow (stacked) rendering lives inside SurfaceStep's scroll body. */}
                {hasSummary && (
                    <aside
                        className={cn(
                            'border-base-300 hidden min-h-0 flex-col overflow-y-auto border-l px-6 py-6 @[720px]:flex',
                            SUMMARY_BG
                        )}
                    >
                        {summary}
                    </aside>
                )}
            </div>
        </div>
    );
    return (
        <ExternalActionsTargetContext.Provider value={mergeIntoHostChrome ? actionsTarget : undefined}>
            <ActionSlotProvider>
                <SurfaceContext.Provider
                    value={{ variant, onCancel: showBackLink ? undefined : onCancel, cancelLabel, summary }}
                >
                    {variant === 'embedded' ? (
                        <div className="bg-base-200 h-full overflow-hidden">{inner}</div>
                    ) : (
                        inner
                    )}
                </SurfaceContext.Provider>
            </ActionSlotProvider>
        </ExternalActionsTargetContext.Provider>
    );
}

// ── SurfaceFrame ──────────────────────────────────────────────────────────────

export function SurfaceFrame({
    variant = 'page',
    wordmark,
    title,
    backLabel,
    lede,
    steps,
    current,
    context,
    onStepSelect,
    canSelectStep,
    footer,
    onCancel,
    cancelLabel,
    summary,
    headerActions,
    actionsTarget,
    className,
    children,
    open,
    onOpenChange,
    onRequestClose,
}: SurfaceFrameProps) {
    const selectable = React.useCallback(
        (key: string, index: number) => (canSelectStep ? canSelectStep(key, index) : index <= current),
        [canSelectStep, current]
    );

    // Page-variant working pane: scroll it back to the top whenever the step
    // changes (the rail is the constant, the pane is what moves). Declared
    // unconditionally — hooks can't sit behind the early-returns; in the other
    // variants the ref stays null and the scroll is a harmless no-op.
    const paneRef = React.useRef<HTMLElement>(null);
    React.useEffect(() => {
        paneRef.current?.scrollTo({ top: 0 });
    }, [current]);

    // ── Modal variant — top stepper inside a self-owned dialog ────────────────────
    if (variant === 'modal') {
        const guard = (event: Event) => {
            if (onRequestClose && onRequestClose() === false) event.preventDefault();
        };
        return (
            <SurfaceContext.Provider value={{ variant: 'modal' }}>
                <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
                    <DialogPrimitive.Portal>
                        <DialogPrimitive.Overlay
                            className={cn(
                                'fixed inset-0 z-50 bg-black/50 backdrop-blur-sm',
                                'data-[state=open]:animate-in data-[state=open]:fade-in-0',
                                'data-[state=closed]:animate-out data-[state=closed]:fade-out-0'
                            )}
                        />
                        <DialogPrimitive.Content
                            onPointerDownOutside={guard}
                            onEscapeKeyDown={guard}
                            aria-describedby={undefined}
                            className={cn(
                                'fixed top-1/2 left-1/2 z-50 -translate-x-1/2 -translate-y-1/2',
                                'h-[min(680px,88vh)] w-[min(920px,94vw)] overflow-hidden',
                                'border-base-300 bg-base-100 rounded-2xl border shadow-md',
                                'max-[940px]:h-screen max-[940px]:w-screen max-[940px]:max-w-none max-[940px]:rounded-none',
                                'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
                                'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
                                className
                            )}
                        >
                            <DialogPrimitive.Title className="sr-only">
                                {typeof title === 'string' ? title : 'Form'}
                            </DialogPrimitive.Title>
                            <TopStepperFrame
                                title={title}
                                steps={steps}
                                current={current}
                                context={context}
                                onStepSelect={onStepSelect}
                                canSelectStep={selectable}
                                footer={footer}
                            >
                                {children}
                            </TopStepperFrame>
                        </DialogPrimitive.Content>
                    </DialogPrimitive.Portal>
                </DialogPrimitive.Root>
            </SurfaceContext.Provider>
        );
    }

    // ── Inline / embedded — the F layout (form column + live summary) ─────────────
    // `inline` is hosted by the drawer/modal detail panel (which supplies the title
    // + close/switch/maximize chrome), so it omits the title strip; `embedded` is
    // the in-flow full page inside the dashboard chrome, so it shows the title.
    // `context` (the old per-step rail note) is intentionally dropped here — the
    // step's own supporting copy carries the guidance and the summary fills the
    // space. The `onStepSelect`/`canSelectStep` jump-to-step affordance lives on
    // the immersive rail + self-owned modal; the compact MiniProgress is display-only.
    if (variant === 'inline' || variant === 'embedded') {
        return (
            <FSurfaceFrame
                variant={variant}
                title={title}
                headerActions={headerActions}
                backLabel={backLabel}
                steps={steps}
                current={current}
                summary={summary}
                onCancel={onCancel}
                cancelLabel={cancelLabel}
                actionsTarget={actionsTarget}
                className={className}
            >
                {children}
            </FSurfaceFrame>
        );
    }

    // ── Page variant — the immersive rail (first-run onboarding) ──────────────────
    return (
        <SurfaceContext.Provider value={{ variant: 'page' }}>
            <div
                className={cn(
                    'bg-base-200 grid h-screen grid-cols-[340px_1fr] overflow-hidden',
                    'max-[940px]:grid-cols-1 max-[940px]:grid-rows-[auto_1fr]',
                    className
                )}
            >
                <RailTopBar
                    brand={wordmark ?? <RailWordmark />}
                    steps={steps}
                    current={current}
                    className="hidden max-[940px]:flex"
                />
                <Rail
                    brand={wordmark ?? <RailWordmark />}
                    lede={lede}
                    steps={steps}
                    current={current}
                    context={context}
                    onStepSelect={onStepSelect}
                    canSelectStep={selectable}
                    footer={footer}
                    className="max-[940px]:hidden"
                />
                <main ref={paneRef} className="min-w-0 overflow-y-auto">
                    {children}
                </main>
            </div>
        </SurfaceContext.Provider>
    );
}

// ── SurfaceStep ───────────────────────────────────────────────────────────────

export interface SurfaceStepActions {
    onBack?: () => void;
    /** Defaults to "Back". Accepts `{ full, short }` for long custom wording —
     *  most callers never need to (it's plain "Back"). */
    backLabel?: ResponsiveLabel;
    onNext?: () => void;
    /** Defaults to "Continue". The primary action's wording is the one MOST
     *  likely to run long ("Create draft & continue", "Publish product") — pass
     *  `{ full, short }` so it shortens on a narrow toolbar instead of wrapping
     *  or crowding out Cancel/Back/Skip. */
    nextLabel?: ResponsiveLabel;
    nextDisabled?: boolean;
    nextLoading?: boolean;
    /** When set, the primary button becomes a real `type="submit"` associated
     *  with this form id (via the `form` attribute, since the frame's toolbar sits
     *  OUTSIDE the form). This is what makes Enter-in-a-field save. With it set,
     *  `onNext` is unnecessary — the form's own `onSubmit` runs the save. */
    nextForm?: string;
    onSkip?: () => void;
    /** Defaults to "Skip for now" — pass `{ full: 'Skip for now', short: 'Skip' }`
     *  (or similar) so it doesn't crowd the primary button on a narrow toolbar. */
    skipLabel?: ResponsiveLabel;
    /** A destructive action (e.g. a Delete button) seated in the left cluster
     *  AFTER Cancel/Back — so Cancel stays the leftmost anchor on every surface,
     *  while the destructive action sits left-of-center, away from the primary so
     *  it can't be mis-clicked, and never inside the read-only summary aside. Edit
     *  surfaces pass their delete here; create surfaces omit it. Pass a real
     *  `@sparx/ui` <Button> at the toolbar's default size (not `size="sm"`) so it
     *  lines up with Cancel/Save. */
    destructive?: React.ReactNode;
    /** Extra nodes in the action row, left of Skip/Next (e.g. a secondary link). */
    extra?: React.ReactNode;
}

export interface SurfaceStepProps {
    /** Left-aligned step header. No uppercase mono eyebrow (no-eyebrows rule). */
    header?: { title: React.ReactNode; supporting?: React.ReactNode };
    /** The standard Back/Skip/Next action row. Omit for steps that own their
     *  primary action elsewhere (e.g. the Modules plan card, the template gallery). */
    actions?: SurfaceStepActions;
    /** Working-pane width (centered column). */
    width?: 'narrow' | 'default' | 'wide';
    className?: string;
    children: React.ReactNode;
}

const WIDTH_CLASS: Record<NonNullable<SurfaceStepProps['width']>, string> = {
    narrow: 'max-w-xl',
    default: 'max-w-4xl',
    wide: 'max-w-6xl',
};

function StepHeader({ header }: { header: NonNullable<SurfaceStepProps['header']> }) {
    return (
        <div className="flex flex-col gap-2">
            <Heading level={2}>{header.title}</Heading>
            {header.supporting && (
                <Text variant="muted" className="max-w-[58ch]">
                    {header.supporting}
                </Text>
            )}
        </div>
    );
}

function ActionRow({
    actions,
    onCancel,
    cancelLabel = 'Cancel',
}: {
    actions?: SurfaceStepActions;
    onCancel?: () => void;
    cancelLabel?: ResponsiveLabel;
}) {
    const {
        onBack,
        backLabel: stepBackLabel = 'Back',
        onNext,
        nextLabel = 'Continue',
        nextDisabled,
        nextLoading,
        nextForm,
        onSkip,
        skipLabel = { full: 'Skip for now', short: 'Skip' },
        destructive,
        extra,
    } = actions ?? {};
    const hasLeftCluster = Boolean(onCancel) || Boolean(onBack) || Boolean(destructive);
    const hasRightCluster = Boolean(extra) || Boolean(onSkip) || onNext != null || nextForm != null;
    // A plain flex row, NOT silica's `Toolbar` primitive — that component is a
    // self-contained formatting-toolbar widget (bordered chrome, tight 2px gaps,
    // flat ghost-only buttons for things like Bold/Italic) and stamps its own
    // `toolbar-button` class over anything passed to it via `render`, flattening
    // real pill buttons into a joined, dated-looking block. The Astryx docking
    // convention this satisfies is the ROW itself (top-docked, in-flow, secondary
    // left / primary right) — the buttons inside it are ordinary Buttons.
    return (
        <div className="flex items-center gap-2">
            {/* Cancel is ALWAYS the leftmost button in this cluster — the same anchor
          on every surface (create, edit, wizard) so a user never hunts for it.
          Back follows, then any destructive action (Delete), away from the
          primary so it can't be mis-clicked — never buried in the summary aside. */}
            {hasLeftCluster && (
                <div className="flex items-center gap-1">
                    {onCancel && (
                        <Button variant="ghost" color="neutral" size="sm" onClick={onCancel}>
                            <AdaptiveLabel label={cancelLabel} />
                        </Button>
                    )}
                    {onBack && (
                        <Button variant="ghost" color="neutral" size="sm" onClick={onBack}>
                            <AdaptiveLabel label={stepBackLabel} />
                        </Button>
                    )}
                    {destructive}
                </div>
            )}
            {hasLeftCluster && hasRightCluster && (
                <div aria-hidden className="bg-base-300 h-5 w-px shrink-0" />
            )}
            {hasRightCluster && (
                <div className="flex items-center gap-1">
                    {extra}
                    {onSkip && (
                        <Button variant="ghost" color="neutral" size="sm" onClick={onSkip}>
                            <AdaptiveLabel label={skipLabel} />
                        </Button>
                    )}
                    {(onNext != null || nextForm != null) && (
                        <Button
                            size="sm"
                            color="module"
                            type={nextForm ? 'submit' : 'button'}
                            form={nextForm}
                            onClick={nextForm ? undefined : onNext}
                            disabled={(nextDisabled ?? false) || (nextLoading ?? false)}
                            loading={nextLoading}
                        >
                            <AdaptiveLabel label={nextLabel} />
                        </Button>
                    )}
                </div>
            )}
        </div>
    );
}

export function SurfaceStep({
    header,
    actions,
    width = 'default',
    className,
    children,
}: SurfaceStepProps) {
    const { variant, onCancel, cancelLabel, summary } = React.useContext(SurfaceContext);
    const actionSlotNode = React.useContext(ActionSlotNodeContext);
    const externalActionsTarget = React.useContext(ExternalActionsTargetContext);
    // A host-supplied target (see `actionsTarget` on SurfaceFrame) takes priority
    // over the frame's own internal toolbar slot — that's the whole point of it.
    const portalTarget = externalActionsTarget !== undefined ? externalActionsTarget : actionSlotNode;
    const isF = variant === 'inline' || variant === 'embedded';
    const topStepper = isF || variant === 'modal';

    // Top-stepper family (inline / embedded / self-owned modal): a flex column
    // that fills the pane — a scrolling body, and the action row PORTALED up into
    // the frame's own toolbar (FrameToolbar) instead of pinned to this step's
    // bottom edge. The F variants additionally seat Cancel in the toolbar and,
    // when too narrow for the summary aside, stack the summary as a card after
    // the fields (container query — see FSurfaceFrame).
    if (topStepper) {
        // F variants FILL their column (the drawer / modal / contained sheet width is
        // already the readable bound) so the content spans edge-to-edge with symmetric
        // px-7 — a max-width cap here would strand the right side in a gutter. The
        // modal / page variants keep their centered fixed column.
        const colWidth = isF ? '' : WIDTH_CLASS[width];
        return (
            <div className={cn('flex h-full flex-col', className)}>
                {/* The scrolling work area sits a tonal step below the surface so the
            module-striped step card pops against it (DESIGN.md tonal layering),
            instead of white-on-white. The chrome rails — stepper/header above and
            the action toolbar below — stay on surface, framing this band. */}
                <div className="border-primary bg-base-200 min-h-0 flex-1 overflow-y-auto border border-1">
                    {/* F variants left-align the column under the header (px-7); the modal /
              page variants keep it centered. Centering an F body would drift it
              right of the flush-left header on a wide (no-summary) sheet. */}
                    <div className={cn('w-full px-7 py-6 max-[680px]:px-5', colWidth, !isF && 'mx-auto')}>
                        {header && <StepHeader header={header} />}
                        <div
                            className={cn(
                                header && 'mt-6',
                                'animate-in fade-in-0 slide-in-from-bottom-2 duration-300 motion-reduce:animate-none'
                            )}
                        >
                            {children}
                        </div>
                        {isF && summary && (
                            <div
                                className={cn(
                                    'border-base-300 mt-6 rounded-xl border px-5 py-4 @[720px]:hidden',
                                    SUMMARY_BG
                                )}
                            >
                                {summary}
                            </div>
                        )}
                    </div>
                </div>
                {portalTarget && (actions != null || (isF && onCancel != null))
                    ? createPortal(
                        <ActionRow
                            actions={actions}
                            onCancel={isF ? onCancel : undefined}
                            cancelLabel={cancelLabel}
                        />,
                        portalTarget
                    )
                    : null}
            </div>
        );
    }

    // Page (immersive rail): a centered column with generous padding; the action
    // row flows after the content at the same width.
    return (
        <div
            className={cn(
                'mx-auto w-full px-14 py-13 max-[940px]:px-5 max-[940px]:py-8',
                WIDTH_CLASS[width],
                className
            )}
        >
            {header && <StepHeader header={header} />}
            <div
                className={cn(
                    header && 'mt-7',
                    'animate-in fade-in-0 slide-in-from-bottom-2 duration-300 motion-reduce:animate-none'
                )}
            >
                {children}
            </div>
            {actions && (
                <div className="mt-9">
                    <ActionRow actions={actions} />
                </div>
            )}
        </div>
    );
}
