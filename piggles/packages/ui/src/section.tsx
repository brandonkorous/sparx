import type { ReactNode } from 'react';

/**
 * Every page-level section on every Piggles site. The vertical rhythm, the
 * gutter and the content width live here and nowhere else.
 *
 * There are two shapes and they are not interchangeable:
 *
 *   band   full-bleed. A surface on it reaches both viewport edges. The default,
 *          and what plain content on the page ground wants.
 *   panel  an inset rounded object floating on the ground, with air around it.
 *
 * `className` is the SURFACE in both cases — background, border, ink — so it
 * lands on whichever element is actually the surface: the outer `<section>` for
 * a band, the inner panel for a panel. Never put spacing in it.
 */
export function Section({
  children,
  variant = 'band',
  className = '',
  theme,
  id,
}: {
  children: ReactNode;
  variant?: 'band' | 'panel';
  className?: string;
  /** Anchor target, for a link that jumps to this section. */
  id?: string;
  /**
   * Makes the section a real theme island. A dark background utility is NOT one:
   * it paints a surface and changes nothing about how tokens resolve, so every
   * control inside goes on resolving against the light palette.
   */
  theme?: 'light' | 'dark';
}) {
  if (variant === 'panel') {
    return (
      // The outer padding is the GAP between stacked panels. Without it two
      // panels in a row touch and read as one long object.
      <section id={id} className="px-4 py-8 sm:px-6 sm:py-12">
        <div
          data-theme={theme}
          className={`rounded-section mx-auto max-w-7xl px-6 py-16 sm:px-10 sm:py-20 lg:px-14 ${className}`}
        >
          {children}
        </div>
      </section>
    );
  }

  return (
    <section id={id} data-theme={theme} className={`px-6 py-16 sm:py-24 ${className}`}>
      {/* max-w-7xl is not optional. A band without it lets prose run the full
          width of a desktop monitor, which is the one failure this component
          exists to make impossible. */}
      <div className="mx-auto max-w-7xl">{children}</div>
    </section>
  );
}
