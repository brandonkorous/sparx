'use client';

// The frame a preview renders in, and the widths it can be judged at.
//
// An iframe, because the thing being previewed is a real page served by the real
// storefront — not an approximation drawn by the editor. That is the entire point of
// a preview as distinct from a canvas.
//
// The width buttons resize the FRAME, so the page inside reflows exactly as it would
// on a phone. A different act from the canvas's device switch, which resizes a design
// surface; here nothing is being designed, only checked.

import type { ReactNode } from 'react';
import { Button } from '@wizeworks/silicaui-react';

export type PreviewWidth = 'phone' | 'tablet' | 'full';

/**
 * Literal classes — a computed width compiles to nothing and the frame silently
 * stops resizing.
 *
 * NOT clamped to the pane. The site inside this iframe lays itself out against the
 * IFRAME's width, so `max-w-full` on a 700px pane made Tablet 700px wide: it drew
 * the narrow layout and called it a tablet, and Tablet and Full width rendered
 * identically. A device preview whose width is not that device's is worse than no
 * preview, because it is believed. Wider than the pane scrolls, which is honest.
 */
const WIDTHS: { value: PreviewWidth; label: string; className: string }[] = [
  { value: 'phone', label: 'Phone', className: 'w-[390px]' },
  { value: 'tablet', label: 'Tablet', className: 'w-[834px]' },
  { value: 'full', label: 'Full width', className: 'w-full' },
];

export function PreviewFrame({
  url,
  srcDoc,
  width,
  onWidth,
  label,
  onRetry,
  children,
}: {
  /** The address to show. Null while one is being minted, or after a failure. */
  url?: string | null;
  /** Markup to show instead of an address — how an email preview is rendered. */
  srcDoc?: string;
  width: PreviewWidth;
  onWidth: (width: PreviewWidth) => void;
  label: string;
  onRetry?: () => void;
  /** Anything the pane wants above the frame — an email's checks, for instance. */
  children?: ReactNode;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <WidthPicker width={width} onWidth={onWidth} />
      {children}
      <div className="min-h-0 flex-1 overflow-auto p-4">
        {url || srcDoc ? (
          <Frame url={url} srcDoc={srcDoc} width={width} label={label} />
        ) : (
          <Unavailable onRetry={onRetry} />
        )}
      </div>
    </div>
  );
}

function WidthPicker({
  width,
  onWidth,
}: {
  width: PreviewWidth;
  onWidth: (width: PreviewWidth) => void;
}) {
  return (
    <div className="border-base-300 flex shrink-0 items-center gap-1 border-b px-2 py-1.5">
      {WIDTHS.map((option) => (
        <Button
          key={option.value}
          size="sm"
          {...(width === option.value ? { color: 'primary' as const } : {})}
          onClick={() => onWidth(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}

function Frame({
  url,
  srcDoc,
  width,
  label,
}: {
  url?: string | null;
  srcDoc?: string;
  width: PreviewWidth;
  label: string;
}) {
  const sized = WIDTHS.find((option) => option.value === width) ?? WIDTHS[2]!;
  return (
    <iframe
      // Keyed by what it is showing, so a refresh remounts the frame rather than
      // relying on the browser to re-request an identical address.
      key={url ?? 'inline'}
      {...(srcDoc === undefined ? { src: url ?? undefined } : { srcDoc })}
      title={label}
      className={`bg-base-100 mx-auto block h-full min-h-[32rem] rounded-lg border-0 ${sized.className}`}
    />
  );
}

function Unavailable({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
      <p className="text-base-content">This preview could not be loaded.</p>
      {onRetry ? (
        <Button color="primary" variant="soft" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}
