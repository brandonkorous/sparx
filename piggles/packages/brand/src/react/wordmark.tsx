// The Piggles marks, drawn from the delivered vector art.
//
// Geometry lives in ../marks.ts; this file is only the React surface. Nothing
// downstream should ever inline a path or the word "Piggles" as styled type —
// when the art is revised, marks.ts changes and every surface follows.
//
// COLOR RESOLVES FROM TOKENS, NEVER FROM THE SOURCE FILE. The delivered SVGs
// paint in a literal pink that does not match the approved token (see the header
// of ../marks.ts). Both components here render in `currentColor` — with the
// wordmark's "i" dot the single exception, pinned to `--color-primary` because it
// is the one spot of brand in the lockup. That is what makes the marks correct
// inside a dark theme island with nothing passed in, and what makes a token
// change propagate to the logo for free.

import {
    ICON_VIEWBOX,
    ICON_BODY_PATH,
    ICON_SNOUT_PATH,
    ICON_SNOUT_OPACITY,
    ICON_NOSTRIL_PATHS,
    WORDMARK_VIEWBOX,
    WORDMARK_LETTER_PATHS,
    WORDMARK_DOT_PATH,
    LOGO_VIEWBOX,
    LOGO_ICON_OFFSET,
    LOGO_WORDMARK_OFFSET,
} from '../marks';

export interface MarkProps {
    /** Sizing and color come from utilities — `h-10 w-10 text-primary`. A numeric
     *  size prop would have to become an inline `style`, which is banned. */
    className?: string;
    /** Give the mark an accessible name when it stands alone as a link or logo.
     *  Omit it wherever a visible wordmark already names the brand — a second
     *  announcement of "Piggles" is noise to a screen reader. */
    title?: string;
}

/** The mark alone — the pig-snout "P". Square, and legible down to favicon size.
 *
 *  The snout is drawn at 20% of the current ink rather than in a second color,
 *  exactly as the source art does it. That is why it reads as the pale pink of
 *  the identity board on a light surface AND stays correct on a dark one, where
 *  a baked pale pink would be a smudge. */
export function Mark({ className = 'h-10 w-10 text-primary', title }: MarkProps) {
    return (
        <svg
            viewBox={ICON_VIEWBOX}
            className={className}
            fill="currentColor"
            role={title ? 'img' : 'presentation'}
            aria-hidden={title ? undefined : true}
        >
            {title ? <title>{title}</title> : null}
            <path d={ICON_BODY_PATH} />
            <path d={ICON_SNOUT_PATH} opacity={ICON_SNOUT_OPACITY} />
            {ICON_NOSTRIL_PATHS.map((d) => (
                <path key={d.slice(0, 24)} d={d} />
            ))}
        </svg>
    );
}

export interface WordmarkProps {
    className?: string;
    title?: string;
}

/** The "Piggles" lockup.
 *
 *  Letterforms inherit `currentColor` so the word sits in whatever ink surrounds
 *  it; the dot over the "i" is pinned to the brand pink. Keep that split — making
 *  the letters pink loses the mark's contrast, and making the dot inherit loses
 *  the only brand color in the lockup. */
export function Wordmark({ className = 'h-8 w-auto', title }: WordmarkProps) {
    return (
        <svg
            viewBox={WORDMARK_VIEWBOX}
            className={className}
            fill="currentColor"
            role={title ? 'img' : 'presentation'}
            aria-hidden={title ? undefined : true}
        >
            {title ? <title>{title}</title> : null}
            {WORDMARK_LETTER_PATHS.map((d) => (
                <path key={d.slice(0, 24)} d={d} />
            ))}
            <path d={WORDMARK_DOT_PATH} fill="var(--color-primary)" />
        </svg>
    );
}

/** The full horizontal logo — the delivered lockup, not an arrangement of the
 *  other two.
 *
 *  ONE `<svg>` on the lockup's own canvas, with the icon and wordmark placed at
 *  the offsets measured off `logo.svg` (see LOGO_*_OFFSET in ../marks). It was
 *  previously an `inline-flex` with `gap-3` and two independently sized
 *  children, which is a reasonable-looking guess and was wrong on both counts:
 *  the real lockup sets the icon and wordmark at a specific size ratio, and
 *  their padded boxes actually OVERLAP, so no positive gap could reproduce it.
 *
 *  Geometry still comes from the shared constants, so this cannot drift from the
 *  standalone `<Mark>` and `<Wordmark>` — only the placement is new.
 *
 *  Sized by the caller with a height; the width follows the aspect ratio. */
export function Logo({
    className = 'h-10 w-auto',
    title = 'Piggles',
}: {
    className?: string;
    title?: string;
}) {
    return (
        <svg
            viewBox={LOGO_VIEWBOX}
            className={className}
            fill="currentColor"
            role="img"
            aria-label={title}
            xmlns="http://www.w3.org/2000/svg"
        >
            <g transform={`translate(${LOGO_ICON_OFFSET.x} ${LOGO_ICON_OFFSET.y})`}>
                {/* The mark is painted from the token DIRECTLY, not via a `text-primary`
            class. Two reasons: it removes any dependency on Tailwind having
            scanned this package to emit that class (the failure that once
            rendered these marks unsized), and it matches how the "i" dot is
            already painted. In the full lockup the pig is always brand pink —
            unlike the standalone <Mark>, which inherits so a caller can place it
            in any ink. */}
                <path d={ICON_BODY_PATH} fill="var(--color-primary)" />
                <path d={ICON_SNOUT_PATH} fill="var(--color-primary)" opacity={ICON_SNOUT_OPACITY} />
                {ICON_NOSTRIL_PATHS.map((d) => (
                    <path key={d.slice(0, 24)} d={d} fill="var(--color-primary)" />
                ))}
            </g>

            <g transform={`translate(${LOGO_WORDMARK_OFFSET.x} ${LOGO_WORDMARK_OFFSET.y})`}>
                {WORDMARK_LETTER_PATHS.map((d) => (
                    <path key={d.slice(0, 24)} d={d} />
                ))}
                <path d={WORDMARK_DOT_PATH} fill="var(--color-primary)" />
            </g>
        </svg>
    );
}
