'use client';

import * as React from 'react';

/**
 * Minimal renderer for the generated legal documents.
 *
 * This is deliberately NOT a general markdown engine — it only understands the
 * subset `lib/legal-templates` emits (h1–h3, bullets, `**bold**`, and an
 * italic footnote line).
 *
 * It renders a *simulated printed document*, so it opts out of the theme on
 * purpose: the preview is always ink-on-paper, matching what the visitor gets
 * when they print it or paste the markdown into their own site. That paper +
 * ink pair is the one sanctioned exception to the "never declare a background +
 * foreground pair" rule in this directory — and it is spelled with Tailwind's
 * own fixed palette (`bg-white` / `text-zinc-*`) rather than a raw hex, so it
 * stays a token and deliberately does NOT follow `data-theme`.
 */
export function LegalDocument({ text }: { text: string }) {
  return (
    <div className="flex max-h-[420px] flex-col overflow-y-auto bg-white p-6 font-sans text-zinc-800">
      {text.split('\n').map((line, i) => (
        <Line key={i} line={line} index={i} />
      ))}
    </div>
  );
}

function Line({ line, index }: { line: string; index: number }) {
  if (!line.trim()) return <div className="h-2" />;
  if (line.startsWith('### '))
    return <h4 className="text-h4 mt-3 mb-1 font-bold">{line.slice(4)}</h4>;
  if (line.startsWith('## '))
    return <h3 className="text-h3 mt-4 mb-1.5 font-bold">{line.slice(3)}</h3>;
  if (line.startsWith('# ')) return <h2 className="text-h2 mb-2 font-bold">{line.slice(2)}</h2>;
  if (line.startsWith('- '))
    return (
      <div className="text-body-sm relative pl-4">
        <span className="absolute left-0">•</span>
        {inline(line.slice(2), index)}
      </div>
    );
  if (line.startsWith('_') && line.endsWith('_'))
    return <p className="text-caption m-0 text-zinc-500">{line.slice(1, -1)}</p>;
  return <p className="text-body-sm m-0">{inline(line, index)}</p>;
}

/** Split on `**bold**` runs and emit `<strong>` for each. */
function inline(text: string, key: number): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <React.Fragment key={key}>
      {parts.map((p, i) =>
        p.startsWith('**') && p.endsWith('**') ? <strong key={i}>{p.slice(2, -2)}</strong> : p
      )}
    </React.Fragment>
  );
}
