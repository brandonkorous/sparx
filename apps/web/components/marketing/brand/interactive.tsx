'use client';

import * as React from 'react';
import { Button } from '@wizeworks/silicaui-react';
import { Text } from '../primitives';

/**
 * Brand-page interactive primitives.
 *
 * The brand guide is a working reference: every token should be one click away
 * from a designer's or partner's clipboard. These two client components carry
 * that affordance — a copyable mono chip (`CopyValue`, a silica <Button>) and a
 * color tile that stacks the live swatch over its copyable hex + token
 * (`Swatch`).
 *
 * Controls are silicaui components; the color specimen block is the one bespoke
 * piece (there is no design-system component for a raw swatch). Type/radius come
 * from the silica tokens.
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
 * beat. A silica <Button> (outline for the strong tone, ghost for subtle) so it
 * carries the system's radius, focus ring, and hover — used for every hex, CSS
 * variable, and font string on the page.
 */
export function CopyValue({ value, label, tone = 'subtle' }: CopyValueProps) {
  const { copied, copy } = useCopy();
  return (
    <Button
      type="button"
      size="sm"
      color="neutral"
      variant={tone === 'strong' ? 'outline' : 'ghost'}
      onClick={() => copy(value)}
      aria-label={label ?? `Copy ${value}`}
      className="font-mono font-normal"
      iconEnd={
        <span aria-hidden style={{ color: copied ? 'var(--color-success)' : undefined }}>
          {copied ? '✓' : '⧉'}
        </span>
      }
    >
      {value}
    </Button>
  );
}

// Normalize ANY computed CSS color to an uppercase hex, so a swatch DISPLAYS the
// value the browser actually resolved the token to — never a hand-typed hex that
// drifts from @sparx/brand/theme.css.
//
// Canvas does the color-space conversion for us: assigning to `fillStyle`
// normalizes rgb()/lab()/oklab()/color() alike down to sRGB. An rgb()-only regex
// is not enough — modern browsers return `lab(...)` for some resolved tokens
// (that's why the base-content swatch showed no hex at all).
function cssColorToHex(input: string): string | null {
  if (!input) return null;
  const ctx = document.createElement('canvas').getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = '#000000';
  try {
    ctx.fillStyle = input;
  } catch {
    return null;
  }
  const v = ctx.fillStyle;
  if (typeof v !== 'string') return null;
  if (v.startsWith('#')) return v.toUpperCase();
  // Translucent colors normalize to `rgba(...)` instead of a hex.
  const m = /rgba?\(([^)]+)\)/i.exec(v);
  if (!m?.[1]) return null;
  const [r, g, b] = m[1].split(',').map((p) => parseFloat(p.trim()));
  if ([r, g, b].some((n) => n === undefined || Number.isNaN(n))) return null;
  const to = (n: number) => Math.round(n).toString(16).padStart(2, '0');
  return `#${to(r!)}${to(g!)}${to(b!)}`.toUpperCase();
}

export interface SwatchProps {
  /** Display name, e.g. "Primary" or "Page background". */
  name: string;
  /** CSS color painted into the tile. Pass a `var(--color-*)` so the tile stays
   *  live — the displayed hex is read back from what it actually resolves to. */
  value: string;
  /** SSR/fallback hex shown until the live value is read on the client. */
  hex?: string;
  /** Optional CSS variable name shown + copied below the hex. */
  token?: string;
  /** One-line usage note under the swatch. */
  note?: string;
  /** Height of the color block in px. Default 88. */
  height?: number;
  /** Resolve the tile under a specific theme (e.g. `dark`) so a dark-mode token
   *  can be previewed on the light page. Only the tile flips, not the labels. */
  theme?: 'light' | 'dark';
}

/**
 * A color tile: the LIVE swatch over its name, the resolved hex (read from the
 * painted `var()` so it can't drift), the copyable token, and an optional note.
 * The block carries an inset hairline so very light tints still read as bounded.
 */
export function Swatch({ name, value, hex, token, note, height = 88, theme }: SwatchProps) {
  const tileRef = React.useRef<HTMLDivElement>(null);
  const [resolved, setResolved] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!tileRef.current) return;
    const bg = getComputedStyle(tileRef.current).backgroundColor;
    const asHex = cssColorToHex(bg);
    if (asHex) setResolved(asHex);
  }, [value, theme]);

  const shownHex = resolved ?? hex;

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div
        ref={tileRef}
        data-theme={theme}
        className="rounded-lg"
        style={{
          height,
          backgroundColor: value,
          boxShadow:
            'inset 0 0 0 1px color-mix(in oklab, var(--color-base-content) 12%, transparent)',
        }}
      />
      <div className="flex flex-col gap-2">
        <Text as="span" size={14} weight={500} tone="default">
          {name}
        </Text>
        <div className="flex flex-wrap gap-1.5">
          {shownHex ? <CopyValue value={shownHex} tone="strong" /> : null}
          {token ? <CopyValue value={token} /> : null}
        </div>
        {note ? (
          <Text as="span" size={12.5} tone="muted">
            {note}
          </Text>
        ) : null}
      </div>
    </div>
  );
}
