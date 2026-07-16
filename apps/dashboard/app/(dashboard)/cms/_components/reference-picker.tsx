'use client';

// Entry reference picker — searches `/v1/content/entries` and lets the
// caller commit a `{ entryId, typeKey, label }` triple. Same UX is exposed
// to the rich-text editor via the @-mention popover; this modal is the
// version the schema-driven form uses for `reference` fields.

import * as React from 'react';
import { Button, Dialog, DialogContent, DialogTitle, Input } from '@wizeworks/silicaui-react';
import { Search } from 'lucide-react';
import { searchEntries } from './cms-internal-api';

export interface PickedReference {
  entryId: string;
  typeKey: string;
  label: string;
}

export interface ReferencePickerProps {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  onPick: (ref: PickedReference) => void;
  /** Restrict to a single content type — e.g. `blog_post`. */
  typeKey?: string;
}

interface Result {
  id: string;
  typeKey: string;
  slug: string | null;
  status: string;
  title: string;
}

export function ReferencePicker({ open, onOpenChange, onPick, typeKey }: ReferencePickerProps) {
  const [q, setQ] = React.useState('');
  const [results, setResults] = React.useState<Result[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Debounced search.
  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const handle = setTimeout(() => {
      setLoading(true);
      setError(null);
      searchEntries({ q, typeKey, limit: 20 })
        .then((rows) => {
          if (cancelled) return;
          setResults(rows);
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          setError(err instanceof Error ? err.message : 'Search failed.');
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [q, typeKey, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <div className="px-6 pt-6">
          <DialogTitle>Pick an entry to reference</DialogTitle>
        </div>
        <div className="px-6 py-2">
          <div className="flex flex-col gap-3">
            <div className="flex flex-row items-center gap-2">
              <Search className="text-base-content h-4 w-4" />
              <Input
                placeholder={
                  typeKey ? `Search ${typeKey.replace(/_/g, ' ')} entries…` : 'Search any entry…'
                }
                value={q}
                onChange={(e) => setQ(e.target.value)}
                aria-label="Search entries"
              />
            </div>
            {loading && <p className="text-base-content text-base">Searching…</p>}
            {error && <p className="text-danger text-base">{error}</p>}
            {!loading && !error && results.length === 0 && (
              <p className="text-base-content text-base">No entries match yet.</p>
            )}
            <div className="flex max-h-[50vh] flex-col gap-1 overflow-y-auto">
              {results.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() =>
                    onPick({
                      entryId: r.id,
                      typeKey: r.typeKey,
                      // Empty-string fallthrough — `??` would only catch
                      // null/undefined so `||` is the right semantic here.
                      // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
                      label: r.title || r.slug || r.id,
                    })
                  }
                  className="border-base-300 hover:bg-base-200 focus:ring-primary rounded-md border px-3 py-2 text-left focus:ring-2 focus:outline-none"
                >
                  <div className="flex flex-col gap-0">
                    {/* eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing */}
                    <p className="text-sm">{r.title || r.slug || r.id}</p>
                    <p className="text-base-content text-xs">
                      {r.typeKey}
                      {r.slug ? ` · /${r.slug}` : ''} · {r.status}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 px-6 pb-6">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
