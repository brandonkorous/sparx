'use client';

/**
 * Tabbed code block — the dark code card from the marketing developer section,
 * adapted for docs. Accepts one or more tabs; each tab's `code` may be a plain
 * string or pre-highlighted JSX (wrap tokens in <span className="tk-*">).
 *
 * Syntax highlighting is intentionally caller-supplied for now: it avoids a
 * build-time highlighter dependency (Shiki/rehype) in the framework's first
 * cut. Swapping in automatic highlighting later only changes what `code`
 * contains, not this component's API.
 */
import { useRef, useState, type ReactNode } from 'react';

export interface CodeTab {
  label: string;
  code: ReactNode;
  /** Optional per-tab line numbers (count). Omit to hide the gutter. */
  lines?: number;
}

export function CodeBlock({
  tabs,
  caption,
  status,
  variant = 'default',
}: {
  tabs: CodeTab[];
  /** Uppercase label on the left of the header bar, e.g. "Request". */
  caption?: string;
  /** Right-side status text, e.g. "200 OK · 41ms". */
  status?: string;
  variant?: 'default' | 'resp';
}) {
  const [active, setActive] = useState(0);
  const [copied, setCopied] = useState(false);
  const panelRefs = useRef<(HTMLPreElement | null)[]>([]);

  const copy = async () => {
    const text = panelRefs.current[active]?.innerText ?? '';
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* clipboard unavailable (e.g. insecure context) — no-op */
    }
  };

  return (
    <div className={`docs-code${variant === 'resp' ? ' resp' : ''}`}>
      <div className="docs-code-head">
        {caption ? <span className="docs-code-cap">{caption}</span> : null}
        <div className="docs-code-tabs" role="tablist">
          {tabs.map((tab, i) => (
            <button
              key={tab.label}
              type="button"
              role="tab"
              aria-selected={active === i}
              className={`docs-code-tab${active === i ? ' active' : ''}`}
              onClick={() => setActive(i)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {status ? (
          <span className="docs-code-status">
            <span className="dot" />
            {status}
          </span>
        ) : (
          <button type="button" className="docs-code-copy" onClick={copy}>
            <svg width={13} height={13} viewBox="0 0 24 24" fill="none" aria-hidden>
              <rect x={9} y={9} width={11} height={11} rx={2} stroke="currentColor" strokeWidth={2} />
              <path d="M5 15V5a2 2 0 012-2h10" stroke="currentColor" strokeWidth={2} />
            </svg>
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        )}
      </div>
      {tabs.map((tab, i) => (
        <div key={tab.label} className={`docs-code-panel${active === i ? ' active' : ''}`}>
          <pre
            className="docs-code-lines"
            ref={(el) => {
              panelRefs.current[i] = el;
            }}
          >
            {tab.code}
          </pre>
        </div>
      ))}
    </div>
  );
}
