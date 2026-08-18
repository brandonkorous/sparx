'use client';

import * as React from 'react';

/**
 * Minimal renderer for the generated legal documents.
 *
 * This is deliberately NOT a general markdown engine — it only understands the
 * subset `lib/legal-templates` emits (h1–h3, bullets, `**bold**`, and an
 * italic footnote line).
 *
 * It renders a *simulated printed document*, so it pins itself to the light
 * theme on purpose: the preview is always ink-on-paper, matching what the
 * visitor gets when they print it or paste the markdown into their own site.
 *
 * `data-theme="light"` on the root is how that is expressed — it locks this
 * subtree to the sparx light palette, so `bg-base-100` / `text-base-content`
 * resolve to paper and ink and do not follow the page's theme. Previously the
 * same intent was spelled with Tailwind's own palette (`bg-white` /
 * `text-zinc-*`), which is a third color vocabulary next to silica's.
 */
export function LegalDocument({ text }: { text: string }) {
  return (
    <div
      data-theme="light"
      className="text-base-content bg-base-100 flex max-h-[420px] flex-col overflow-y-auto p-6 font-sans"
    >
      {text.split('\n').map((line, i) => (
        <Line key={i} line={line} index={i} />
      ))}
    </div>
  );
}

function Line({ line, index }: { line: string; index: number }) {
  if (!line.trim()) return <div className="h-2" />;
  if (line.startsWith('### '))
    return <h4 className="mt-3 mb-1 text-xl font-bold">{line.slice(4)}</h4>;
  if (line.startsWith('## '))
    return <h3 className="mt-4 mb-1.5 text-2xl font-bold">{line.slice(3)}</h3>;
  if (line.startsWith('# ')) return <h2 className="mb-2 text-2xl font-bold">{line.slice(2)}</h2>;
  if (line.startsWith('- '))
    return (
      <div className="text-md relative pl-4">
        <span className="absolute left-0">•</span>
        {inline(line.slice(2), index)}
      </div>
    );
  if (line.startsWith('_') && line.endsWith('_'))
    return <p className="text-base-content m-0 text-sm">{line.slice(1, -1)}</p>;
  return <p className="text-md m-0">{inline(line, index)}</p>;
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
