/**
 * Docs prose primitives — the authoring vocabulary for a documentation page.
 *
 * Pages compose <DocArticle> (header + prose column + optional on-this-page
 * TOC + helpful footer + pager) from these building blocks. Following docs/23
 * §1, presentation lives in named classes (app/docs/docs.css) referencing
 * tokens — feature code never re-skins controls inline.
 *
 * Server components throughout; the interactive islands (TOC scroll-spy, code
 * tabs, feedback) are imported from sibling client components.
 */
import type { ReactNode } from 'react';
import Link from 'next/link';
import { OnThisPage, type TocItem } from './on-this-page';
import { DocFeedback } from './feedback';

/* ──────────────────────────── ARTICLE SHELL ──────────────────────────── */

export interface Crumb {
  label: string;
  href?: string;
}
export interface PagerLink {
  title: string;
  href: string;
}

export function DocArticle({
  breadcrumb,
  title,
  badge,
  lede,
  meta,
  toc,
  editPath,
  updated,
  prev,
  next,
  children,
}: {
  breadcrumb?: Crumb[];
  title: string;
  badge?: ReactNode;
  lede?: ReactNode;
  meta?: ReactNode;
  toc?: TocItem[];
  /** Repo-relative path to the source file, for "Edit this page". */
  editPath?: string;
  /** Human "last updated" date string. */
  updated?: string;
  prev?: PagerLink;
  next?: PagerLink;
  children: ReactNode;
}) {
  const hasToc = !!toc && toc.length > 0;
  return (
    <div className={hasToc ? 'docs-article' : 'docs-article no-toc'}>
      <main className="docs-main">
        <article className="docs-prose">
          {breadcrumb ? <Breadcrumb items={breadcrumb} /> : null}
          <div className="docs-title-row">
            <h1 className="docs-title">
              {title}
              <span className="docs-spark">.</span>
            </h1>
            {badge}
          </div>
          {lede ? <p className="docs-lede">{lede}</p> : null}
          {meta ? <div className="docs-meta">{meta}</div> : null}

          {children}

          {(editPath !== undefined || updated !== undefined) && (
            <div className="docs-foot">
              <DocFeedback />
              <div className="docs-editlink">
                {editPath ? (
                  <a
                    href={`https://github.com/brandonkorous/sparx/edit/main/${editPath}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Edit this page on GitHub ↗
                  </a>
                ) : null}
                {updated ? <span>Last updated {updated}</span> : null}
              </div>
            </div>
          )}

          {(prev !== undefined || next !== undefined) && (
            <div className="docs-pager">
              {prev ? (
                <Link href={prev.href} className="prev">
                  <div className="dir">← Previous</div>
                  <div className="pg-title">{prev.title}</div>
                </Link>
              ) : (
                <span />
              )}
              {next ? (
                <Link href={next.href} className="next">
                  <div className="dir">Next →</div>
                  <div className="pg-title">{next.title}</div>
                </Link>
              ) : (
                <span />
              )}
            </div>
          )}
        </article>
      </main>
      {toc && toc.length > 0 ? <OnThisPage items={toc} /> : null}
    </div>
  );
}

export function Breadcrumb({ items }: { items: Crumb[] }) {
  return (
    <nav className="docs-breadcrumb" aria-label="Breadcrumb">
      {items.map((c, i) => (
        <span key={`${c.label}-${i}`} className="inline-flex gap-2">
          {c.href ? <a href={c.href}>{c.label}</a> : <span className="current">{c.label}</span>}
          {i < items.length - 1 ? <span className="sep">/</span> : null}
        </span>
      ))}
    </nav>
  );
}

/* ──────────────────────────── HEADINGS ──────────────────────────── */

export function DocSection({
  id,
  title,
  children,
}: {
  id: string;
  title: ReactNode;
  children: ReactNode;
}) {
  return (
    <section>
      <h2 id={id}>
        <a href={`#${id}`} className="docs-anchor" aria-hidden tabIndex={-1}>
          #
        </a>
        {title}
      </h2>
      {children}
    </section>
  );
}

export function DocSubsection({
  id,
  title,
  children,
}: {
  id?: string;
  title: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      <h3 id={id}>
        {id ? (
          <a href={`#${id}`} className="docs-anchor" aria-hidden tabIndex={-1}>
            #
          </a>
        ) : null}
        {title}
      </h3>
      {children}
    </>
  );
}

/* ──────────────────────────── INLINE ──────────────────────────── */

export function InlineCode({ children }: { children: ReactNode }) {
  return <code className="docs-code-inline">{children}</code>;
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="docs-kbd">{children}</kbd>;
}

export function DocLink({ href, children }: { href: string; children: ReactNode }) {
  const external = href.startsWith('http');
  return (
    <a
      href={href}
      className="docs-link"
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
    >
      {children}
    </a>
  );
}

export type BadgeTone = 'get' | 'post' | 'del' | 'gray';
export function Badge({ tone = 'gray', children }: { tone?: BadgeTone; children: ReactNode }) {
  return <span className={`docs-badge ${tone}`}>{children}</span>;
}

export function EndpointChip({ method, path }: { method: string; path: string }) {
  const tone: BadgeTone =
    method === 'GET' ? 'get' : method === 'DELETE' ? 'del' : method === 'POST' ? 'post' : 'gray';
  return (
    <div className="docs-endpoint">
      <Badge tone={tone}>{method}</Badge>
      <span className="path">{path}</span>
    </div>
  );
}

/* ──────────────────────────── CALLOUT ──────────────────────────── */

export type CalloutType = 'note' | 'info' | 'tip' | 'warn' | 'danger';

const CALLOUT_STROKE: Record<CalloutType, string> = {
  note: '#52525b',
  info: '#0ea5e9',
  tip: '#4f46e5',
  warn: '#92400e',
  danger: '#991b1b',
};

function CalloutIcon({ type }: { type: CalloutType }) {
  const stroke = CALLOUT_STROKE[type];
  if (type === 'warn' || type === 'danger') {
    return (
      <svg width={18} height={18} viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M12 3L22 19H2L12 3Z" stroke={stroke} strokeWidth={2} strokeLinejoin="round" />
        <path d="M12 10V13M12 16H12.01" stroke={stroke} strokeWidth={2} strokeLinecap="round" />
      </svg>
    );
  }
  if (type === 'tip') {
    return (
      <svg width={18} height={18} viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M9 18H15M10 21H14M12 3C8.7 3 6 5.7 6 9C6 11.2 7.2 12.9 8.5 14H15.5C16.8 12.9 18 11.2 18 9C18 5.7 15.3 3 12 3Z"
          stroke={stroke}
          strokeWidth={2}
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  // note + info
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx={12} cy={12} r={9} stroke={stroke} strokeWidth={2} />
      <path d="M12 11V16M12 8H12.01" stroke={stroke} strokeWidth={2} strokeLinecap="round" />
    </svg>
  );
}

export function Callout({
  type = 'note',
  title,
  children,
}: {
  type?: CalloutType;
  title?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={`docs-callout ${type}`}>
      <span className="ico">
        <CalloutIcon type={type} />
      </span>
      <div className="ct">
        {title ? <strong>{title}</strong> : null}
        {children}
      </div>
    </div>
  );
}

/* ──────────────────────────── STEPPER ──────────────────────────── */

export function Steps({ children }: { children: ReactNode }) {
  return <div className="docs-steps">{children}</div>;
}

export function Step({
  n,
  title,
  done,
  children,
}: {
  n: number;
  title: ReactNode;
  done?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={done ? 'docs-step done' : 'docs-step'}>
      <div className="num">{n}</div>
      <p className="st">{title}</p>
      {children}
    </div>
  );
}

/* ──────────────────────────── ACCORDION ──────────────────────────── */

export function Accordion({
  title,
  open,
  children,
}: {
  title: ReactNode;
  open?: boolean;
  children: ReactNode;
}) {
  return (
    <details className="docs-accordion" open={open}>
      <summary>
        {title}
        <svg className="chev" width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M9 6L15 12L9 18" stroke="currentColor" strokeWidth={2} />
        </svg>
      </summary>
      <div className="acc-body">{children}</div>
    </details>
  );
}

/* ──────────────────────────── TABLE ──────────────────────────── */

export function DocTable({ children }: { children: ReactNode }) {
  return (
    <div className="docs-table-wrap">
      <table className="docs-table">{children}</table>
    </div>
  );
}

/** Monospace type annotation for a table cell. */
export function TypeTag({ children }: { children: ReactNode }) {
  return <span className="type">{children}</span>;
}

/* ──────────────────────────── BLOCKQUOTE ──────────────────────────── */

export function DocQuote({ cite, children }: { cite?: ReactNode; children: ReactNode }) {
  return (
    <blockquote className="docs-quote">
      <p>{children}</p>
      {cite ? <cite>{cite}</cite> : null}
    </blockquote>
  );
}

/* ──────────────────────────── FIGURE ──────────────────────────── */

export function DocFigure({ caption, children }: { caption?: ReactNode; children: ReactNode }) {
  return (
    <figure className="docs-fig">
      <div className="frame">{children}</div>
      {caption ? <figcaption>{caption}</figcaption> : null}
    </figure>
  );
}

/** A screenshot/figure with a real image and optional caption. */
export function DocImage({ src, alt, caption }: { src: string; alt: string; caption?: ReactNode }) {
  return (
    <figure className="docs-img">
      <img src={src} alt={alt} />
      {caption ? <figcaption>{caption}</figcaption> : null}
    </figure>
  );
}

/* ──────────────────────────── CARD GRID ──────────────────────────── */

export function NextSteps({ children }: { children: ReactNode }) {
  return <div className="docs-cards">{children}</div>;
}

export function NextCard({
  href,
  title,
  icon,
  children,
}: {
  href: string;
  title: ReactNode;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Link href={href} className="docs-card">
      {icon ? <div className="nc-icon">{icon}</div> : null}
      <div className="nc-title">
        {title} <span className="nc-arrow">→</span>
      </div>
      <div className="nc-body">{children}</div>
    </Link>
  );
}
