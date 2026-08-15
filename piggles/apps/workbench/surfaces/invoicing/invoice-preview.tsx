'use client';

// The invoice preview — a pane, not a panel.
//
// It renders the same server-rendered HTML the dashboard shows, from the same
// endpoint. The only thing that changed is who decides where it goes. It follows
// whichever editor is publishing a draft for this document id, and it does not
// care whether that editor is beside it, behind it, or on another monitor — it
// subscribes to the draft store and never looks for the editor.
//
// Which means the preview keeps working with no editor open at all: with no
// draft published it simply previews the saved document.

import { useEffect, useState, useSyncExternalStore } from 'react';
import { useQuery } from '@sparx/query';
import { Loading } from '@wizeworks/silicaui-react';
import { apiRequest } from '../../lib/api/client';
import { draftKey, readDraft, subscribeDraft, type DraftValue } from '../../lib/drafts';
import type { SurfaceContext } from '../../lib/surfaces/registry';

/** Debounce keystroke-rate draft changes into preview renders. */
const RENDER_DEBOUNCE_MS = 350;

function useDraft(key: string): DraftValue | null {
  return useSyncExternalStore(
    (listener) => subscribeDraft(key, listener),
    () => readDraft(key),
    () => null
  );
}

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(value);
    }, delay);
    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);
  return debounced;
}

export function InvoicePreviewSurface({ ctx }: { ctx: SurfaceContext }) {
  const id = ctx.params.id ?? 'new';
  const draft = useDraft(draftKey('invoice', id));
  const debouncedDraft = useDebounced(draft, RENDER_DEBOUNCE_MS);

  useEffect(() => {
    ctx.setTitle('Preview');
  }, [ctx]);

  const { data: html, isFetching } = useQuery({
    // The draft is part of the key so an edit produces a new render, and
    // identical drafts are served from cache rather than re-rendered.
    queryKey: ['invoicing', 'preview', id, debouncedDraft],
    queryFn: async () => {
      const response = await apiRequest<Response>({
        method: 'POST',
        path: '/v1/invoicing/documents/preview',
        // With no draft published, preview the saved document by id.
        body: debouncedDraft ?? { documentId: id === 'new' ? undefined : id },
        raw: true,
      });
      return response.data.text();
    },
    // Preview is derived, never authoritative — keep the last good render on
    // screen while the next one is in flight rather than flashing empty.
    placeholderData: (previous) => previous,
  });

  return (
    <div className="bg-base-200 relative h-full">
      {isFetching ? (
        <div className="absolute top-3 right-3 z-10">
          <Loading size="sm" />
        </div>
      ) : null}

      {html ? (
        // Sandboxed: this is tenant-authored template HTML rendered server-side,
        // and it has no reason to run scripts or reach back into the workbench.
        <iframe
          title="Invoice preview"
          srcDoc={html}
          sandbox=""
          className="h-full w-full border-0 bg-white"
        />
      ) : (
        <div className="flex h-full items-center justify-center text-sm">Preparing preview…</div>
      )}
    </div>
  );
}
