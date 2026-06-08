'use client';

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from '../../utils/cva';
import { cn } from '../../utils/cn';

// Sidebar chrome for the dashboard. SidebarItem is the module-aware row —
// active items adopt --module-active so the wrapping ModuleProvider drives
// the highlight color automatically.

export const Sidebar = React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(
  ({ className, ...props }, ref) => (
    <aside
      ref={ref}
      className={cn(
        'flex h-full w-56 shrink-0 flex-col gap-1 border-r border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-3',
        className
      )}
      {...props}
    />
  )
);
Sidebar.displayName = 'Sidebar';

export const SidebarHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('px-2 pt-1 pb-3', className)} {...props} />
);
SidebarHeader.displayName = 'SidebarHeader';

// Scrollable <nav> region that fills the available space between the
// SidebarHeader and SidebarFooter. Defaults to a "Primary" a11y label —
// override with `label` when there are multiple navs in the same tree.
export interface SidebarNavProps extends React.HTMLAttributes<HTMLElement> {
  label?: string;
}
export const SidebarNav = ({ className, label = 'Primary', ...props }: SidebarNavProps) => (
  <nav
    aria-label={label}
    className={cn('flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto', className)}
    {...props}
  />
);
SidebarNav.displayName = 'SidebarNav';

export const SidebarSection = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col gap-0.5 py-2', className)} {...props} />
);
SidebarSection.displayName = 'SidebarSection';

export const SidebarSectionLabel = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'px-2 pb-1 text-xs font-medium tracking-wider text-[var(--color-text-tertiary)] uppercase',
      className
    )}
    {...props}
  />
);
SidebarSectionLabel.displayName = 'SidebarSectionLabel';

export const SidebarFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn('mt-auto border-t border-[var(--color-border-default)] pt-2', className)}
    {...props}
  />
);
SidebarFooter.displayName = 'SidebarFooter';

const sidebarItemVariants = cva(
  [
    'group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium',
    'transition-colors duration-150',
    'focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)] focus-visible:outline-none',
    'disabled:pointer-events-none disabled:opacity-40',
  ],
  {
    variants: {
      active: {
        false:
          'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-text-primary)]',
        true: 'bg-[var(--module-active-tint)] text-[var(--module-active-text)]',
      },
    },
    defaultVariants: { active: false },
  }
);

export interface SidebarItemProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof sidebarItemVariants> {
  icon?: React.ReactNode;
  /** When true, the item is rendered into the polymorphic child (e.g. a Next.js Link). */
  asChild?: boolean;
  /**
   * Always tint the glyph with the active module color (`--module-active`),
   * regardless of `active` — for module-owned rows that read as a color-coded
   * module marker (the module switcher, a module's favorite/recent). The caller
   * must supply the matching `<ModuleProvider>`. Default false: the glyph is
   * module-colored only when active, quiet tertiary otherwise.
   */
  moduleIcon?: boolean;
  /**
   * Icon-only mode: the label is dropped and the glyph centers in a compact
   * square, with the label surfaced as a hover tooltip (when `children` is a
   * string). For a collapsed side panel — mirrors the icon rail.
   */
  collapsed?: boolean;
}

export const SidebarItem = React.forwardRef<HTMLButtonElement, SidebarItemProps>(
  (
    {
      className,
      active,
      icon,
      asChild = false,
      moduleIcon = false,
      collapsed = false,
      title,
      children,
      ...props
    },
    ref
  ) => {
    const dataActive = active ? true : undefined;
    const ariaCurrent = active ? 'page' : undefined;
    // The glyph is tinted independently of the label. `moduleIcon` forces the
    // module color always; otherwise it's the module color only when active and
    // a quiet tertiary→secondary on hover when not. --module-active resolves
    // from the nearest ModuleProvider either way.
    const iconSpan = icon ? (
      <span
        className={cn(
          'inline-flex h-4 w-4 shrink-0 items-center justify-center',
          moduleIcon || active
            ? 'text-[var(--module-active)]'
            : 'text-[var(--color-text-tertiary)] group-hover:text-[var(--color-text-secondary)]'
        )}
      >
        {icon}
      </span>
    ) : null;
    // Collapsed → a compact centered square (matches the icon rail's w-8 tiles);
    // the variant's px-2/py-1.5 are overridden by twMerge.
    const itemClass = cn(
      sidebarItemVariants({ active }),
      collapsed && 'h-8 w-8 justify-center px-0 py-0',
      className
    );
    if (asChild) {
      const child = React.Children.only(children) as React.ReactElement<{
        children?: React.ReactNode;
      }>;
      const childLabel = child.props.children;
      const tooltip =
        title ?? (collapsed && typeof childLabel === 'string' ? childLabel : undefined);
      const wrapped = React.cloneElement(
        child,
        undefined,
        collapsed ? (
          iconSpan
        ) : (
          <>
            {iconSpan}
            <span className="flex-1 truncate text-left">{childLabel}</span>
          </>
        )
      );
      return (
        <Slot
          ref={ref}
          className={itemClass}
          data-active={dataActive}
          aria-current={ariaCurrent}
          title={tooltip}
          {...props}
        >
          {wrapped}
        </Slot>
      );
    }
    const tooltip = title ?? (collapsed && typeof children === 'string' ? children : undefined);
    return (
      <button
        ref={ref}
        type="button"
        className={itemClass}
        data-active={dataActive}
        aria-current={ariaCurrent}
        title={tooltip}
        {...props}
      >
        {collapsed ? (
          iconSpan
        ) : (
          <>
            {iconSpan}
            <span className="flex-1 truncate text-left">{children}</span>
          </>
        )}
      </button>
    );
  }
);
SidebarItem.displayName = 'SidebarItem';

export { sidebarItemVariants };
