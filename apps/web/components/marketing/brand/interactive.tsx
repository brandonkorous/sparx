'use client';

import * as React from 'react';

/**
 * Brand-page interactive primitives.
 *
 * The brand guide is a working reference: every token should be one click away
 * from a designer's or partner's clipboard. These two client components carry
 * that affordance — a copyable mono chip (`CopyValue`) and a color tile that
 * stacks the live swatch over its copyable hex + token (`Swatch`).
 *
 * Bespoke chrome on the marketing surface — inline styles reference tokens from
 * packages/ui/src/tokens.css (docs/23 §1). The copy interaction is the only
 * reason these live outside the server-rendered sections.
 */

function useCopy() {
  const [copied, setCopied] = React.useState(false);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => () => clearTimeoutRef(timer), []);

  const copy = React.useCallback((value: string) => {
    void navigator.clipboard?.writeText(value).then(() => {
      setCopied(true);
      clearTimeoutRef(timer);
      timer.current = setTimeout(() => setCopied(false), 1400);
    });
  }, []);

  return { copied, copy };
}

function clearTimeoutRef(ref: React.MutableRefObject<ReturnType<typeof setTimeout> | null>) {
  if (ref.current) clearTimeout(ref.current);
}

export interface CopyValueProps {
  /** Text shown in the chip and copied to the clipboard. */
  value: string;
  /** Optional label read by screen readers (defaults to "Copy {value}"). */
  label?: string;
  /** Subtle (default) renders tertiary ink; `strong` renders primary ink. */
  tone?: 'subtle' | 'strong';
}

/**
 * A monospace chip that copies its value on click and flips to "Copied" for a
 * beat. Used for every hex, CSS variable, and font string on the page.
 */
export function CopyValue({ value, label, tone = 'subtle' }: CopyValueProps) {
  const { copied, copy } = useCopy();
  const [hover, setHover] = React.useState(false);
  return (
    <button
      type="button"
      onClick={() => copy(value)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      aria-label={label ?? `Copy ${value}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '7px',
        padding: '4px 9px',
        fontFamily: 'var(--font-mono)',
        fontSize: '12px',
        lineHeight: 1,
        color: tone === 'strong' ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
        backgroundColor: hover ? 'var(--color-bg-subtle)' : 'transparent',
        border: '1px solid var(--color-border-default)',
        borderRadius: 'var(--radius-md)',
        cursor: 'pointer',
        transition: 'background-color var(--transition-fast), color var(--transition-fast)',
      }}
    >
      <span>{value}</span>
      <span aria-hidden style={{ color: copied ? 'var(--color-success)' : 'var(--color-text-tertiary)' }}>
        {copied ? '✓' : '⧉'}
      </span>
    </button>
  );
}

export interface SwatchProps {
  /** Display name, e.g. "Primary" or "Page background". */
  name: string;
  /** CSS color painted into the tile (a hex or a var()). */
  value: string;
  /** Hex string shown + copied. */
  hex: string;
  /** Optional CSS variable name shown + copied below the hex. */
  token?: string;
  /** One-line usage note under the swatch. */
  note?: string;
  /** Height of the color block in px. Default 88. */
  height?: number;
}

/**
 * A color tile: the live swatch over its name, copyable hex, copyable token,
 * and an optional usage note. The block carries an inset hairline so very light
 * tints (e.g. #EEF2FF) still read as a bounded surface.
 */
export function Swatch({ name, value, hex, token, note, height = 88 }: SwatchProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', minWidth: 0 }}>
      <div
        style={{
          height,
          borderRadius: 'var(--radius-lg)',
          backgroundColor: value,
          boxShadow: 'inset 0 0 0 1px rgba(9, 9, 11, 0.08)',
        }}
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <span
          style={{
            fontFamily: 'var(--font-sans)',
            fontWeight: 500,
            fontSize: '14px',
            color: 'var(--color-text-primary)',
          }}
        >
          {name}
        </span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          <CopyValue value={hex} tone="strong" />
          {token ? <CopyValue value={token} /> : null}
        </div>
        {note ? (
          <span
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: '12.5px',
              lineHeight: '18px',
              color: 'var(--color-text-tertiary)',
            }}
          >
            {note}
          </span>
        ) : null}
      </div>
    </div>
  );
}
