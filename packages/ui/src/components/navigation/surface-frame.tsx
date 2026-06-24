'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Check } from 'lucide-react';
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
   *  the frame renders as a real ghost Button in the bottom toolbar. */
  footer?: React.ReactNode;
  /** The leave/cancel action for the in-app variants. The frame renders it as a
   *  ghost Cancel Button so it always matches Back/Next — at the left of the F
   *  variants' bottom action toolbar. Never hand-roll a cancel <button> at the
   *  call site (that drift is exactly what stranded the old styling — docs/86). */
  onCancel?: () => void;
  /** Label for the frame-owned Cancel button. Defaults to "Cancel". */
  cancelLabel?: string;
  /** F variants (inline/embedded): a live "draft summary" tree (compose with
   *  SurfaceSummary / SurfaceSummaryRow). Renders as the right-hand column when the
   *  frame is wide and stacks as a card after the fields when narrow. Omit for
   *  wizards without a natural summary — the form then fills the full width. */
  summary?: React.ReactNode;
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
   *  ghost Cancel Button in the bottom toolbar (matching Back) — never raw JSX. */
  onCancel?: () => void;
  /** Label for the frame-owned Cancel button (default "Cancel"). */
  cancelLabel?: string;
  /** F variants: the live summary content. Rendered as the right-hand column when
   *  the frame is wide enough (container query) and stacked as a card after the
   *  fields when it's narrow (the drawer). */
  summary?: React.ReactNode;
}

const SurfaceContext = React.createContext<SurfaceContextValue>({ variant: 'page' });

// The F layout is responsive by CONTAINER width, not viewport: at/above ~720px
// the frame is two columns (form + summary aside); below it collapses to one and
// the summary stacks as a card after the fields. The `@container` lives on the
// frame root and the `@[720px]:` variants below read it — so a narrow drawer
// stacks even on a wide screen (docs/86). The classes are written as full
// literals (never concatenated) so Tailwind's scanner generates them.
//
// A soft module tint over the surface — the quiet summary panel background.
const SUMMARY_BG = 'bg-[color-mix(in_oklab,var(--module-active)_6%,var(--color-bg-surface))]';

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
                          'border-white bg-white text-[color-mix(in_oklab,var(--module-active)_70%,#000)] ring-4 ring-white/15'
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
    <div className="shrink-0 border-b border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-6 py-4">
      {/* Narrow viewports collapse to a single line (top-2 rule). */}
      <p className="hidden text-center text-xs font-medium text-[var(--color-text-secondary)] max-[680px]:block">
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
                    idx <= current
                      ? 'bg-[var(--module-active)]'
                      : 'bg-[var(--color-border-default)]'
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
                      'border-[var(--color-border-strong)] bg-[var(--color-bg-surface)] text-[var(--color-text-muted)]',
                    status === 'done' &&
                      'border-transparent bg-[var(--module-active)] text-[var(--module-active-content)]',
                    status === 'current' &&
                      'border-transparent bg-[var(--module-active)] text-[var(--module-active-content)] ring-4 ring-[var(--module-active-tint)]'
                  )}
                >
                  {status === 'done' ? <Check className="h-3.5 w-3.5" /> : idx + 1}
                </span>
                <span
                  className={cn(
                    'max-w-[14ch] text-center text-[11px] leading-tight font-medium transition-colors duration-200',
                    status === 'upcoming'
                      ? 'text-[var(--color-text-muted)]'
                      : 'text-[var(--color-text-primary)]'
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

// The header strip above the stepper: the wizard title (left) and the footer /
// cancel affordance (right). Omitted entirely when neither is supplied.
function SurfaceTopHeader({
  title,
  footer,
}: {
  title?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  if (!title && !footer) return null;
  return (
    <div className="flex shrink-0 items-center gap-3 border-b border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-6 py-3">
      {title && (
        <div className="min-w-0 truncate text-sm font-semibold tracking-tight text-[var(--color-text-primary)]">
          {title}
        </div>
      )}
      <div className="flex-1" />
      {footer && (
        <div className="shrink-0 text-[0.8rem] text-[var(--color-text-muted)]">{footer}</div>
      )}
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
    <div
      className={cn('flex h-full flex-col overflow-hidden bg-[var(--color-bg-page)]', className)}
    >
      <SurfaceTopHeader title={title} footer={footer} />
      <TopStepper
        steps={steps}
        current={current}
        onStepSelect={onStepSelect}
        canSelectStep={canSelectStep}
      />
      {context && (
        <p className="shrink-0 border-b border-[var(--color-border-default)] bg-[var(--color-bg-page)] px-6 py-2 text-center text-xs text-[var(--color-text-muted)]">
          {context}
        </p>
      )}
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}

// ── F layout (inline + embedded): form column + live summary ───────────────────
// The in-app create surface (docs/86). A title strip (embedded only — the
// drawer/modal host supplies the title + window controls for inline), a compact
// MiniProgress, the working pane, and a quiet module-tinted summary that fills
// the right column when wide and stacks as a card when narrow. The bottom action
// toolbar (Cancel + Back/Next) lives under the FORM column only; the summary runs
// full height beside it.

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
    <div
      className={cn('flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]', className)}
    >
      <span className="flex items-center gap-1" aria-hidden>
        {steps.map((step, idx) => (
          <span
            key={step.key}
            className={cn(
              'h-1 w-8 rounded-full transition-colors duration-200',
              idx <= current
                ? 'bg-[var(--module-active)]'
                : 'bg-[color-mix(in_oklab,var(--color-text-primary)_12%,transparent)]'
            )}
          />
        ))}
      </span>
      <span className="ml-1.5 font-medium text-[var(--color-text-primary)]">
        {steps[current]?.label}
      </span>
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
      <p className="mb-4 text-[1.0625rem] leading-tight font-medium tracking-tight text-[var(--color-text-primary)]">
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
          'text-sm text-[var(--color-text-muted)]',
          strong && 'text-[0.9375rem] font-semibold text-[var(--color-text-primary)]'
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          'text-sm text-[var(--color-text-primary)] tabular-nums',
          strong && 'text-[0.9375rem] font-semibold'
        )}
      >
        {value}
      </span>
    </div>
  );
}

export function SurfaceSummaryDivider() {
  return <div className="my-1.5 border-t border-[var(--color-border-default)]" />;
}

// The shared F frame. `showHeader` adds the title strip (embedded full page);
// inline omits it because the host chrome owns the title + window controls.
function FSurfaceFrame({
  variant,
  showHeader,
  title,
  steps,
  current,
  summary,
  onCancel,
  cancelLabel,
  className,
  children,
}: {
  variant: 'inline' | 'embedded';
  showHeader: boolean;
  title?: React.ReactNode;
  steps: SurfaceStepDef[];
  current: number;
  summary?: React.ReactNode;
  onCancel?: () => void;
  cancelLabel?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const hasSummary = Boolean(summary);
  const inner = (
    <div
      className={cn(
        '@container flex h-full min-h-0 flex-col overflow-hidden bg-[var(--color-bg-surface)]',
        // Embedded (full page) is a CONTAINED, centered sheet — never edge-to-edge.
        // Capped in width with the page showing on either side; the inline (drawer/
        // modal) host already bounds the frame, so it fills its host instead.
        variant === 'embedded' &&
          cn(
            'mx-auto w-full border-x border-[var(--color-border-default)]',
            // With a summary the sheet is wide (room for form + the right column);
            // without one it's a tight, centered form sheet so the fields don't
            // float in a huge gutter.
            hasSummary ? 'max-w-[1120px]' : 'max-w-[820px]'
          ),
        className
      )}
    >
      {showHeader && title && (
        <div className="flex h-[52px] shrink-0 items-center border-b border-[var(--color-border-default)] px-7 max-[680px]:px-5">
          <span className="truncate text-sm font-semibold tracking-tight text-[var(--color-text-primary)]">
            {title}
          </span>
        </div>
      )}
      <div
        className={cn(
          'grid min-h-0 flex-1 grid-cols-1',
          hasSummary && '@[720px]:grid-cols-[1fr_320px]'
        )}
      >
        {/* Form column: progress + working pane (SurfaceStep owns its scroll +
            the action toolbar pinned at the bottom). A single-step form (one
            step) hides MiniProgress — there's no journey to show. */}
        <div className="flex min-h-0 flex-col">
          {steps.length > 1 && (
            <div className="shrink-0 px-7 pt-4 pb-1 max-[680px]:px-5">
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
              'hidden min-h-0 flex-col overflow-y-auto border-l border-[var(--color-border-default)] px-6 py-6 @[720px]:flex',
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
    <SurfaceContext.Provider value={{ variant, onCancel, cancelLabel, summary }}>
      {variant === 'embedded' ? (
        <div className="h-full overflow-hidden bg-[var(--color-bg-page)]">{inner}</div>
      ) : (
        inner
      )}
    </SurfaceContext.Provider>
  );
}

// ── SurfaceFrame ──────────────────────────────────────────────────────────────

export function SurfaceFrame({
  variant = 'page',
  wordmark,
  title,
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
                'rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] shadow-md',
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
        showHeader={variant === 'embedded'}
        title={title}
        steps={steps}
        current={current}
        summary={summary}
        onCancel={onCancel}
        cancelLabel={cancelLabel}
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
          'grid h-screen grid-cols-[340px_1fr] overflow-hidden bg-[var(--color-bg-page)]',
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
  backLabel?: string;
  onNext?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  nextLoading?: boolean;
  onSkip?: () => void;
  skipLabel?: string;
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
  cancelLabel?: string;
}) {
  const {
    onBack,
    backLabel = 'Back',
    onNext,
    nextLabel = 'Continue',
    nextDisabled,
    nextLoading,
    onSkip,
    skipLabel = 'Skip for now',
    destructive,
    extra,
  } = actions ?? {};
  return (
    <div className="flex items-center justify-between gap-3">
      {/* Cancel is ALWAYS the leftmost button — the same anchor on every surface
          (create, edit, wizard) so a user never hunts for it. Back follows, then
          any destructive action (Delete), seated left-of-center and away from the
          primary so it can't be mis-clicked — never buried in the summary aside.
          All ghost Buttons, one consistent button row (never a hand-rolled link). */}
      <div className="flex items-center gap-2">
        {onCancel && (
          <Button variant="ghost" color="neutral" onClick={onCancel}>
            {cancelLabel}
          </Button>
        )}
        {onBack && (
          <Button variant="ghost" color="neutral" onClick={onBack}>
            {backLabel}
          </Button>
        )}
        {destructive}
      </div>
      <div className="flex items-center gap-2">
        {extra}
        {onSkip && (
          <Button variant="ghost" color="neutral" onClick={onSkip}>
            {skipLabel}
          </Button>
        )}
        {onNext && (
          <Button
            color="module"
            onClick={onNext}
            disabled={(nextDisabled ?? false) || (nextLoading ?? false)}
            loading={nextLoading}
          >
            {nextLabel}
          </Button>
        )}
      </div>
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
  const isF = variant === 'inline' || variant === 'embedded';
  const topStepper = isF || variant === 'modal';

  // Top-stepper family (inline / embedded / self-owned modal): a flex column that
  // fills the pane — a scrolling body and an action row pinned to the bottom edge,
  // both centered on the same column width. The F variants additionally seat
  // Cancel in the toolbar and, when too narrow for the summary aside, stack the
  // summary as a card after the fields (container query — see FSurfaceFrame).
  if (topStepper) {
    // F variants FILL their column (the drawer / modal / contained sheet width is
    // already the readable bound) so the content spans edge-to-edge with symmetric
    // px-7 — a max-width cap here would strand the right side in a gutter. The
    // modal / page variants keep their centered fixed column.
    const colWidth = isF ? '' : WIDTH_CLASS[width];
    return (
      <div className={cn('flex h-full flex-col', className)}>
        <div className="min-h-0 flex-1 overflow-y-auto">
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
                  'mt-6 rounded-xl border border-[var(--color-border-default)] px-5 py-4 @[720px]:hidden',
                  SUMMARY_BG
                )}
              >
                {summary}
              </div>
            )}
          </div>
        </div>
        {(actions != null || (isF && onCancel != null)) && (
          <div className="shrink-0 border-t border-[var(--color-border-default)] bg-[var(--color-bg-surface)]">
            <div className={cn('w-full px-7 py-4 max-[680px]:px-5', colWidth, !isF && 'mx-auto')}>
              <ActionRow
                actions={actions}
                onCancel={isF ? onCancel : undefined}
                cancelLabel={cancelLabel}
              />
            </div>
          </div>
        )}
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
