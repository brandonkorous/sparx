/**
 * Renders a Font Awesome icon definition. No `@fortawesome/fontawesome-svg-core`
 * and no React binding: the icon packages are plain data, and this is the whole
 * renderer.
 *
 * The shape is declared structurally rather than imported, so this package needs
 * no Font Awesome dependency and every `IconDefinition` satisfies it.
 */
export interface IconGlyph {
  /** `[width, height, ligatures, unicode, path]`. */
  readonly icon: readonly [number, number, readonly string[], string, string | readonly string[]];
}

/** What a registry stores when it holds "the icon for this thing". Every Font
 *  Awesome `IconDefinition` satisfies it. */
export type PigglesIcon = IconGlyph;

export interface IconProps {
  glyph: IconGlyph;
  /** Sizing and positioning only — the fill is always `currentColor`. */
  className?: string;
  /**
   * Announces the icon. Omit it for decoration beside a label, which is most of
   * them; an unlabelled icon that carries meaning alone must set it.
   */
  title?: string;
  /** Pixels, for a size computed at runtime. Prefer a `size-*` class otherwise —
   *  it is the house idiom and stays on the spacing scale. */
  size?: number;
  /**
   * Draw the glyph HOLLOW — the fill removed and the same path stroked.
   *
   * Piggles ships one Font Awesome style, so there is no companion outline set
   * to pair a filled icon with. A toggle needs that pair: filled/hollow is a
   * difference in SHAPE, which reads at a glance and still reads when the colour
   * does not reach somebody. Colour alone would be the only alternative.
   *
   * Stroke width is a presentation ATTRIBUTE, in viewBox units — these paths are
   * 512 tall, so it is two orders of magnitude off a CSS pixel. As a class it
   * would also tie with `fill-*` on specificity and let stylesheet order decide
   * the outcome.
   */
  outline?: boolean;
}

/**
 * Piggles is solid-only, decided by looking at it: duotone's back layer sits at
 * 40% and covers most of a glyph, which on this pale palette left the rail
 * washed out and gave back the very weight the move off stroke icons bought.
 */
export function Icon({ glyph, className = '', title, size, outline = false }: IconProps) {
  const [width, height, , , path] = glyph.icon;
  const d = typeof path === 'string' ? path : path[0];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      // Presentation ATTRIBUTES, so any `size-*` class from the caller wins
      // cleanly. As classes they would tie on specificity and the winner would
      // depend on Tailwind's output order.
      width={size ?? '1em'}
      height={size ?? '1em'}
      // The fill/stroke pair is a ternary rather than two classes, so the two can
      // never both apply and leave the result to stylesheet order.
      strokeWidth={outline ? 44 : undefined}
      strokeLinejoin={outline ? 'round' : undefined}
      className={`inline-block ${outline ? 'fill-none stroke-current' : 'fill-current'} ${className}`}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      {title ? <title>{title}</title> : null}
      <path d={d} />
    </svg>
  );
}
