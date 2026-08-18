import Link from 'next/link';
import { buttonClasses, type ButtonClassOptions } from '@wizeworks/silicaui-react/server';

// A `<Button>` that navigates: a plain `next/link` wearing silica's button
// classes. A link is an `<a>`, not a `<button>` — so we render the `<a>` and
// borrow the clothes.
//
// `buttonClasses` is the class-string logic behind `<Button>` with no React
// dependency, exported from `silicaui-react/server` precisely so a Server
// Component can style a plain element directly. Using it here keeps silica's
// `<Button>` — a `'use client'` component — out of the client bundle of pages
// whose only need was a styled anchor.
//
// The other reason is history. silicaui's Button is polymorphic through a
// `render` prop, which internally does `cloneElement(render, mergeProps(ownProps,
// render.props))`. On silicaui < 0.13, `render={<Link/>}` written in a SERVER
// component threw at request time — the element crossed the RSC → client boundary
// and arrived without `.props`, so `mergeProps` died on `render.props.className`.
// It typechecked and it linted; only a live request found it. 0.13's
// `mergeProps(ours, theirs = {})` fixed the crash, and on 0.14 a server-side
// `render={<Link/>}` does render a correct `<a class="btn …" href="…">` (verified).
// We keep this component anyway: passing an element across that boundary relies on
// React handing `.props` through, and the guard's `= {}` default means any future
// regression would drop the `href` silently rather than throw.
//
// Client components may use `render={<Link/>}` directly — they are already past
// the boundary, and it is the right escape hatch when the anchor needs its own
// props (an `onClick` that closes a drawer, say).

export interface ButtonLinkProps extends ButtonClassOptions {
  /** Destination. Internal paths get next/link routing + prefetch. */
  href: string;
  /** Pass through to next/link (e.g. `false` for a rarely-taken link). */
  prefetch?: boolean;
  children: React.ReactNode;
  'aria-label'?: string;
  style?: React.CSSProperties;
}

export function ButtonLink({
  href,
  prefetch,
  children,
  'aria-label': ariaLabel,
  style,
  ...classOptions
}: ButtonLinkProps) {
  return (
    <Link
      href={href}
      className={buttonClasses(classOptions)}
      aria-label={ariaLabel}
      style={style}
      {...(prefetch === undefined ? {} : { prefetch })}
    >
      {children}
    </Link>
  );
}
