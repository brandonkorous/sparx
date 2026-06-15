import * as React from 'react';
import { Slot, Slottable } from '@radix-ui/react-slot';
import { cn } from '../../utils/cn';
import { colorClass, type ColorKey } from '../_recipes/variants';

// ActionTile + ActionQueue — the cross-module "Needs attention" / "Needs you
// today" triage block (the first thing a working owner scans on a module
// overview). A tile = a tinted icon square + a big count + a label, the whole
// surface clickable. `tone` drives the icon square's color via the shared
// role-var recipe, so warning/danger/success read semantically while the
// default `module` tints to the active ModuleProvider color.

function ChevronRight(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

export interface ActionTileProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Leading glyph, rendered inside a `tone`-tinted square. Always provide one. */
  icon: React.ReactNode;
  /** The headline number (or short string) — the count that needs action. */
  count: React.ReactNode;
  /** What the count refers to ("Orders to fulfill"). */
  label: React.ReactNode;
  /** Color of the icon square. Default `module`. Use `warning`/`danger`/
   *  `success` to signal urgency semantically. */
  tone?: ColorKey | (string & {});
  /** Merge styling/behavior onto a child (e.g. a Next `<Link>`) so the whole
   *  tile is the link. The child should be a single element with no content —
   *  the tile's structure is injected. */
  asChild?: boolean;
}

const TILE_CLASS =
  'group relative flex items-center gap-3 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-4 text-left transition-colors hover:border-[var(--color-border-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)] focus-visible:ring-offset-2';

export const ActionTile = React.forwardRef<HTMLDivElement, ActionTileProps>(
  (
    { className, icon, count, label, tone = 'module', asChild = false, children, ...props },
    ref
  ) => {
    const classes = cn(TILE_CLASS, className);

    const iconSquare = (
      <span
        key="icon"
        className={cn(
          colorClass(tone),
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[var(--c-tint,var(--color-bg-subtle))] text-[var(--c-ink,var(--color-text-primary))]'
        )}
      >
        {icon}
      </span>
    );
    const text = (
      <span key="text" className="min-w-0">
        <span className="block text-2xl leading-none font-medium text-[var(--color-text-primary)]">
          {count}
        </span>
        <span className="mt-1 block truncate text-sm text-[var(--color-text-secondary)]">
          {label}
        </span>
      </span>
    );
    const chevron = (
      <ChevronRight
        key="chevron"
        className="ml-auto h-4 w-4 shrink-0 text-[var(--color-text-tertiary)] transition-colors group-hover:text-[var(--module-active)]"
      />
    );

    if (asChild) {
      return (
        <Slot ref={ref} className={classes} {...props}>
          {iconSquare}
          <Slottable>{children}</Slottable>
          {text}
          {chevron}
        </Slot>
      );
    }

    return (
      <div ref={ref} className={classes} {...props}>
        {iconSquare}
        {text}
        {chevron}
      </div>
    );
  }
);
ActionTile.displayName = 'ActionTile';

export interface ActionQueueProps extends Omit<React.HTMLAttributes<HTMLElement>, 'title'> {
  /** Section heading ("Needs you today"). */
  title?: React.ReactNode;
  /** Optional glyph before the title, tinted to the active module. */
  icon?: React.ReactNode;
  /** Right-aligned summary ("33 items across your store"). */
  meta?: React.ReactNode;
  /** Tiles per row at the large breakpoint. Default 4. */
  columns?: 2 | 3 | 4;
}

const COLUMN_CLASS: Record<2 | 3 | 4, string> = {
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
};

export const ActionQueue = React.forwardRef<HTMLElement, ActionQueueProps>(
  ({ className, title, icon, meta, columns = 4, children, ...props }, ref) => (
    <section ref={ref} className={className} {...props}>
      {(title != null || meta != null) && (
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-[0.9375rem] font-medium text-[var(--color-text-primary)]">
            {icon && <span className="text-[var(--module-active)]">{icon}</span>}
            {title}
          </h2>
          {meta && <span className="text-xs text-[var(--color-text-tertiary)]">{meta}</span>}
        </div>
      )}
      <div className={cn('grid gap-3', COLUMN_CLASS[columns])}>{children}</div>
    </section>
  )
);
ActionQueue.displayName = 'ActionQueue';
