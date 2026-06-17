'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Check } from 'lucide-react';
import { cn } from '../../utils/cn';
import { Button } from '../primitives/button';
import { Heading } from '../primitives/heading';
import { Text } from '../primitives/text';
import { RAIL_BG, RailWordmark } from '../brand/brand-rail';

// WizardFrame — the platform's one layout language for guided, multi-step flows
// (docs/86). A persistent two-pane frame: a left RAIL that never moves (brand +
// vertical journey + per-step context) and a right WORKING PANE that is the only
// thing that changes. It ships in two variants of the SAME design so a user who
// learns one knows the other:
//
//   • variant="page"   — full-bleed, first-run/high-stakes setup (onboarding,
//                         blueprint install). Owns the whole viewport.
//   • variant="modal"  — the same frame inside a Radix dialog, for in-dashboard
//                         create-wizards (Product / B2B / Email, docs/68) where
//                         the user shouldn't lose their place.
//   • variant="inline" — the same two-pane frame as the modal, but as plain
//                         in-flow content with NO dialog of its own. For hosting
//                         inside another overlay shell that supplies its own
//                         chrome — the dashboard's drawer/modal detail panel,
//                         where the user's `defaultDetailView` preference picks
//                         drawer vs. modal and the wizard fills the body. It
//                         collapses to the compact top-bar layout in a narrow
//                         drawer via the same breakpoint as the modal.
//
// The rail is a FLAT SOLID fill of the active module color (no gradient — sparx
// is flat by default), driven by the wrapping <ModuleProvider> via
// `--module-active`. Onboarding's rail is Builder Indigo; a Product wizard's is
// Commerce orange; and so on, with zero per-call color props.
//
// This file owns the LAYOUT only. The flow inside it (which steps, which fields,
// validation) is owned by the feature: onboarding by docs/15, the create-wizards
// by docs/68.

// ── Public types ─────────────────────────────────────────────────────────────

export interface WizardStepDef {
  /** Stable key for this step (matches the consumer's step machine). */
  key: string;
  /** Journey label, e.g. "Modules". */
  label: string;
  /** A one-line sublabel under the label, e.g. "What you need". */
  sublabel?: string;
}

export type WizardVariant = 'page' | 'modal' | 'inline';

export interface WizardFrameProps {
  variant?: WizardVariant;
  /** Page variant: the brand node at the rail top. Defaults to the inverted
   *  sparx wordmark (white "Spar" + a light tint of the module color "x"). */
  wordmark?: React.ReactNode;
  /** Modal variant: the wizard's title at the rail top, e.g. "New product". */
  title?: React.ReactNode;
  /** Page variant lede under the brand — a headline + supporting blurb that the
   *  consumer changes per step to narrate the journey. */
  lede?: { title: React.ReactNode; blurb?: React.ReactNode };
  /** The full journey. Order is the source of truth for done/current/upcoming. */
  steps: WizardStepDef[];
  /** Zero-based index of the current step. */
  current: number;
  /** A one-line context card pinned to the rail bottom, reframing this step. */
  context?: React.ReactNode;
  /** Jump to a visited step from the journey. */
  onStepSelect?: (key: string, index: number) => void;
  /** Whether a journey row is clickable. Default: any step at/at-or-before the
   *  current one (you can't skip ahead by clicking). */
  canSelectStep?: (key: string, index: number) => boolean;
  /** Rail footer — utility links (Save & exit / Need help, or Cancel). */
  footer?: React.ReactNode;
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

interface WizardContextValue {
  variant: WizardVariant;
}

const WizardContext = React.createContext<WizardContextValue>({ variant: 'page' });

// ── Rail ─────────────────────────────────────────────────────────────────────
// RAIL_BG + RailWordmark are shared with the auth split-panel via ../brand/brand-rail
// so the colored rail has one source of truth across guided surfaces.

interface RailProps {
  compact?: boolean;
  brand: React.ReactNode;
  lede?: WizardFrameProps['lede'];
  steps: WizardStepDef[];
  current: number;
  context?: React.ReactNode;
  onStepSelect?: WizardFrameProps['onStepSelect'];
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
  steps: WizardStepDef[];
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

// ── WizardFrame ──────────────────────────────────────────────────────────────

export function WizardFrame({
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
  className,
  children,
  open,
  onOpenChange,
  onRequestClose,
}: WizardFrameProps) {
  const selectable = React.useCallback(
    (key: string, index: number) => (canSelectStep ? canSelectStep(key, index) : index <= current),
    [canSelectStep, current]
  );

  const ctx = React.useMemo<WizardContextValue>(() => ({ variant }), [variant]);

  // Page-variant working pane: scroll it back to the top whenever the step
  // changes (the rail is the constant, the pane is what moves). Declared
  // unconditionally — hooks can't sit behind the modal early-return; in the modal
  // variant the ref stays null and the scroll is a harmless no-op.
  const paneRef = React.useRef<HTMLElement>(null);
  React.useEffect(() => {
    paneRef.current?.scrollTo({ top: 0 });
  }, [current]);

  // ── Modal variant ───────────────────────────────────────────────────────────
  if (variant === 'modal') {
    const guard = (event: Event) => {
      if (onRequestClose && onRequestClose() === false) event.preventDefault();
    };
    return (
      <WizardContext.Provider value={ctx}>
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
                'grid h-[min(680px,88vh)] w-[min(920px,94vw)] grid-cols-[240px_1fr] overflow-hidden',
                'rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] shadow-md',
                'max-[940px]:h-screen max-[940px]:w-screen max-[940px]:max-w-none max-[940px]:grid-cols-1 max-[940px]:grid-rows-[auto_1fr] max-[940px]:rounded-none',
                'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
                'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
                className
              )}
            >
              <DialogPrimitive.Title className="sr-only">
                {typeof title === 'string' ? title : 'Wizard'}
              </DialogPrimitive.Title>
              <RailTopBar
                brand={
                  title ? (
                    <span className="text-sm font-medium text-white">{title}</span>
                  ) : (
                    <RailWordmark />
                  )
                }
                steps={steps}
                current={current}
                className="hidden max-[940px]:flex"
              />
              <Rail
                compact
                brand={
                  title ? (
                    <span className="text-base font-medium tracking-tight text-white">{title}</span>
                  ) : (
                    <RailWordmark />
                  )
                }
                steps={steps}
                current={current}
                context={context}
                onStepSelect={onStepSelect}
                canSelectStep={selectable}
                footer={footer}
                className="max-[940px]:hidden"
              />
              <div className="min-h-0 min-w-0">{children}</div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
      </WizardContext.Provider>
    );
  }

  // ── Inline variant ────────────────────────────────────────────────────────────
  // The modal's two-pane frame without the dialog — the host overlay (drawer or
  // modal detail panel) owns the shell. WizardStep renders in its modal layout
  // (scrolling body + pinned action row), so we pin the context to 'modal'.
  if (variant === 'inline') {
    const inlineBrand = title ? (
      <span className="text-sm font-medium text-white">{title}</span>
    ) : (
      <RailWordmark />
    );
    return (
      <WizardContext.Provider value={{ variant: 'modal' }}>
        <div
          className={cn(
            'grid h-full grid-cols-[240px_1fr] overflow-hidden bg-[var(--color-bg-surface)]',
            'max-[940px]:grid-cols-1 max-[940px]:grid-rows-[auto_1fr]',
            className
          )}
        >
          <RailTopBar
            brand={inlineBrand}
            steps={steps}
            current={current}
            className="hidden max-[940px]:flex"
          />
          <Rail
            compact
            brand={
              title ? (
                <span className="text-base font-medium tracking-tight text-white">{title}</span>
              ) : (
                <RailWordmark />
              )
            }
            steps={steps}
            current={current}
            context={context}
            onStepSelect={onStepSelect}
            canSelectStep={selectable}
            footer={footer}
            className="max-[940px]:hidden"
          />
          <div className="min-h-0 min-w-0">{children}</div>
        </div>
      </WizardContext.Provider>
    );
  }

  // ── Page variant ────────────────────────────────────────────────────────────
  return (
    <WizardContext.Provider value={ctx}>
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
    </WizardContext.Provider>
  );
}

// ── WizardStep ───────────────────────────────────────────────────────────────

export interface WizardStepActions {
  onBack?: () => void;
  backLabel?: string;
  onNext?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  nextLoading?: boolean;
  onSkip?: () => void;
  skipLabel?: string;
  /** Extra nodes in the action row, left of Skip/Next (e.g. a secondary link). */
  extra?: React.ReactNode;
}

export interface WizardStepProps {
  /** Left-aligned step header. No uppercase mono eyebrow (no-eyebrows rule). */
  header?: { title: React.ReactNode; supporting?: React.ReactNode };
  /** The standard Back/Skip/Next action row. Omit for steps that own their
   *  primary action elsewhere (e.g. the Modules plan card, the template gallery). */
  actions?: WizardStepActions;
  /** Working-pane width (page variant). */
  width?: 'narrow' | 'default' | 'wide';
  className?: string;
  children: React.ReactNode;
}

const WIDTH_CLASS: Record<NonNullable<WizardStepProps['width']>, string> = {
  narrow: 'max-w-xl',
  default: 'max-w-4xl',
  wide: 'max-w-6xl',
};

function StepHeader({ header }: { header: NonNullable<WizardStepProps['header']> }) {
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

function ActionRow({ actions }: { actions: WizardStepActions }) {
  const {
    onBack,
    backLabel = 'Back',
    onNext,
    nextLabel = 'Continue',
    nextDisabled,
    nextLoading,
    onSkip,
    skipLabel = 'Skip for now',
    extra,
  } = actions;
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        {onBack && (
          <Button variant="ghost" color="neutral" onClick={onBack}>
            {backLabel}
          </Button>
        )}
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

export function WizardStep({
  header,
  actions,
  width = 'default',
  className,
  children,
}: WizardStepProps) {
  const { variant } = React.useContext(WizardContext);

  // Modal: a flex column that fills the dialog pane — a scrolling body and a
  // pinned action row at the dialog's bottom edge.
  if (variant === 'modal') {
    return (
      <div className={cn('flex h-full flex-col', className)}>
        <div className="min-h-0 flex-1 overflow-y-auto px-7 py-6">
          {header && <StepHeader header={header} />}
          <div
            className={cn(
              header && 'mt-6',
              'animate-in fade-in-0 slide-in-from-bottom-2 duration-300 motion-reduce:animate-none'
            )}
          >
            {children}
          </div>
        </div>
        {actions && (
          <div className="shrink-0 border-t border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-7 py-4">
            <ActionRow actions={actions} />
          </div>
        )}
      </div>
    );
  }

  // Page: a centered column with generous padding; the action row flows after
  // the content at the same width.
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
