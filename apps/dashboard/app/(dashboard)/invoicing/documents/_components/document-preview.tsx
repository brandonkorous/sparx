'use client';

// Live document preview — the real, branded, template-aware artifact the customer
// will receive, rendered while the merchant is still typing (docs/87 §10).
//
// It renders through the SAME path as Print: the draft POSTs to
// /invoicing/documents/preview, which builds render data with the same totals
// function the save path uses and routes it through the tenant's published
// template (or the code default). So the preview is the document — not a
// second, hand-maintained approximation of it that can drift.
//
// Rendered into an <iframe srcDoc> on purpose: the artifact ships its own
// complete <html> + <style>, and an iframe is the only way to host that without
// its print CSS leaking into the dashboard (or the dashboard's leaking into it).

import * as React from 'react';
import { Card, CardBody, Loading, Alert, Button } from '@wizeworks/silicaui-react';
import { RefreshCw } from 'lucide-react';

/** Wait for typing to settle before asking the server to re-render. 500ms is the
 *  pause between keystrokes, not a fixed poll — a fast typist triggers ONE render
 *  at the end of a word rather than one per character. */
const DEBOUNCE_MS = 500;

/**
 * In-flight requests keyed by draft payload, so two mounts of this component
 * showing the SAME document issue one request between them.
 *
 * This is not a micro-optimization. `SurfaceFrame` renders its `summary` twice —
 * once in the wide aside and once in a `hidden`-by-CSS stacked copy for narrow
 * layouts — so a preview living in the summary is MOUNTED TWICE and, without
 * this, every edit fires two identical server renders (measured: 4 POSTs for 2
 * draft states). The hidden copy is real, mounted, effect-running React; CSS
 * visibility doesn't stop it. Keying on the payload also means the two mounts
 * resolve from one response, so they can never display different documents.
 */
const inFlight = new Map<string, Promise<string>>();

function fetchPreview(payload: string): Promise<string> {
  const existing = inFlight.get(payload);
  if (existing) return existing;

  // No AbortSignal by design: the request is SHARED, so one subscriber
  // unmounting must not cancel it out from under the other. Each subscriber
  // instead ignores a result that arrives after it has moved on.
  const request = fetch('/invoicing/documents/preview', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: payload,
  })
    .then(async (res) => {
      const text = await res.text();
      if (!res.ok) throw new Error(text.slice(0, 200) || `Preview failed (${res.status})`);
      return text;
    })
    .finally(() => inFlight.delete(payload));

  inFlight.set(payload, request);
  return request;
}

export interface DocumentPreviewProps {
  /** The unsaved document, in the shape the preview endpoint accepts. */
  draft: unknown;
  /** Rendered above the frame; omit for none. */
  title?: React.ReactNode;
  className?: string;
}

export function DocumentPreview({ draft, title, className }: DocumentPreviewProps) {
  const [html, setHtml] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const [attempt, setAttempt] = React.useState(0);

  // Serialize the draft so the effect re-runs on VALUE change, not on the new
  // object identity a parent re-render produces — otherwise every keystroke
  // anywhere on the page would re-request the preview.
  const payload = JSON.stringify(draft ?? {});

  React.useEffect(() => {
    let cancelled = false;
    setPending(true);

    const timer = setTimeout(() => {
      fetchPreview(payload)
        .then((text) => {
          // Superseded by a newer draft (or unmounted) — drop the stale result
          // rather than painting a document the editor has already moved past.
          if (cancelled) return;
          setHtml(text);
          setError(null);
        })
        .catch((e: unknown) => {
          if (cancelled) return;
          setError(e instanceof Error ? e.message : 'Could not build the preview.');
        })
        .finally(() => {
          if (!cancelled) setPending(false);
        });
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [payload, attempt]);

  return (
    <Card className={className}>
      <CardBody className="gap-3">
        {title || pending ? (
          <header className="flex items-center justify-between gap-3">
            <span className="text-base font-medium">{title}</span>
            {/* A quiet spinner beside the title, never a full-frame loading state:
                blanking the document on every keystroke is far more disruptive
                than letting the previous render sit for half a second. */}
            {pending ? <Loading size="sm" /> : null}
          </header>
        ) : null}

        {error ? (
          <Alert color="danger" variant="soft" size="sm">
            <div className="flex items-center justify-between gap-3">
              <span>{error}</span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                color="neutral"
                onClick={() => setAttempt((n) => n + 1)}
              >
                <RefreshCw className="h-4 w-4" />
                Retry
              </Button>
            </div>
          </Alert>
        ) : null}

        {html ? (
          <iframe
            title="Document preview"
            srcDoc={html}
            // The artifact is our own server-rendered HTML, but it can carry a
            // tenant logo URL — sandbox without allow-scripts so nothing in the
            // document can run against the dashboard origin.
            sandbox=""
            className="border-base-300 h-[70vh] w-full rounded-lg border bg-white"
          />
        ) : (
          <div className="border-base-300 flex h-[70vh] w-full items-center justify-center rounded-lg border border-dashed">
            <span className="text-base-content text-base">
              {error ? 'Preview unavailable' : 'Building your preview…'}
            </span>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
