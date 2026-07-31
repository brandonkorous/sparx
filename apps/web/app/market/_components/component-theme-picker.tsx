'use client';

// The component-preview theme control (docs/118). Lets a visitor preview every section
// in any of the 20 sparx themes + Ember, light or dark — affecting ONLY the previews
// (`.cp-surface`), never the marketing site. It works by setting `data-cp-tk` /
// `data-cp-mode` on `<html>`; the scoped stylesheet (<ComponentPreviewStyles>) does the
// rest. The choice is stored in localStorage so it CARRIES between the browse grid and a
// detail page (both are full navigations on the marketing site).

import { useEffect, useState } from 'react';
import { Button } from '@wizeworks/silicaui-react';
import type { PreviewThemeGroup } from '@/lib/preview-themes';

const STORE_KEY = 'sparx.cp-preview';
type Mode = 'light' | 'dark';

function readStored(): { tk: string; mode: Mode } {
  try {
    const s: unknown = JSON.parse(localStorage.getItem(STORE_KEY) ?? '');
    if (s && typeof s === 'object') {
      const { tk, mode } = s as { tk?: unknown; mode?: unknown };
      if (typeof tk === 'string' && (mode === 'light' || mode === 'dark')) return { tk, mode };
    }
  } catch {
    /* no/invalid stored value — fall through to the default */
  }
  return { tk: 'sparx', mode: 'light' };
}

export function ComponentThemePicker({ groups }: { groups: PreviewThemeGroup[] }) {
  const [tk, setTk] = useState('sparx');
  const [mode, setMode] = useState<Mode>('light');

  // Adopt any stored selection on mount, so the choice carries between pages.
  useEffect(() => {
    const s = readStored();
    setTk(s.tk);
    setMode(s.mode);
  }, []);

  // Apply to <html> (only `.cp-surface` reads these) + persist.
  useEffect(() => {
    const el = document.documentElement;
    el.dataset.cpTk = tk;
    el.dataset.cpMode = mode;
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ tk, mode }));
    } catch {
      /* private mode / storage full — the in-page selection still applies */
    }
  }, [tk, mode]);

  return (
    <div className="border-base-300 flex flex-wrap items-center gap-2.5 rounded-lg border px-3 py-2">
      <span className="text-ink-muted text-caption">Preview in</span>
      <select
        className="select select-sm"
        value={tk}
        onChange={(e) => setTk(e.target.value)}
        aria-label="Preview theme"
      >
        {groups.map((g) => (
          <optgroup key={g.label} label={g.label}>
            {g.options.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      <div className="border-base-300 inline-flex items-center gap-1 rounded-full border p-1">
        <Button
          size="sm"
          color="neutral"
          variant={mode === 'light' ? 'soft' : 'ghost'}
          aria-pressed={mode === 'light'}
          onClick={() => setMode('light')}
        >
          Light
        </Button>
        <Button
          size="sm"
          color="neutral"
          variant={mode === 'dark' ? 'soft' : 'ghost'}
          aria-pressed={mode === 'dark'}
          onClick={() => setMode('dark')}
        >
          Dark
        </Button>
      </div>
    </div>
  );
}
