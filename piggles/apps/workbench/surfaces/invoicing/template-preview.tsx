'use client';

// The template drawn as a real page — a pane, not a panel.
//
// Same arrangement as the invoice preview next door: it follows a template id
// and does not care whether an editor is beside it, behind it, or on another
// monitor. Opening it with no editor at all is a perfectly good way to answer
// "what does this one look like".
//
// It renders the SAVED draft, which is the one real difference from the invoice
// preview. That one follows an unsaved draft keystroke by keystroke because a
// half-typed invoice is still a document; a half-arranged template is a layout
// that exists nowhere, and the editor is explicit-save like every other one
// here. The line under the frame says so rather than leaving it to be noticed.

import { useEffect } from 'react';
import { useQuery } from '@wizeworks/query';
import { Loading, Text } from '@wizeworks/silicaui-react';
import { apiRequest } from '../../lib/api/client';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { TEMPLATES_KEY, useTemplate } from './template-data';

export function TemplatePreviewSurface({ ctx }: { ctx: SurfaceContext }) {
  const id = typeof ctx.params.id === 'string' ? ctx.params.id : '';
  // An invoice to draw it against, when the person came here from one. Without
  // it the server supplies representative figures, so the page is never a
  // skeleton of empty rows.
  const documentId = typeof ctx.params.documentId === 'string' ? ctx.params.documentId : '';

  // WHICH template this is drawing. Two previews open read `Preview  Preview`
  // (issue 842). The editor's own read, so opening from an editor is served
  // from cache; a preview opened on its own fetches once.
  const { data: template } = useTemplate(id);
  useEffect(() => {
    ctx.setTitle(template?.name ? `Preview · ${template.name}` : 'Preview');
  }, [ctx, template?.name]);

  const { data: html, isFetching } = useQuery({
    // Keyed off the shared template key, so saving in the editor invalidates
    // this and the frame re-draws without anything here watching the editor.
    queryKey: [...TEMPLATES_KEY, 'preview', id, documentId],
    enabled: id !== '',
    queryFn: async () => {
      const response = await apiRequest<Response>({
        method: 'GET',
        path: `/v1/invoicing/templates/${id}/preview`,
        ...(documentId ? { query: { documentId } } : {}),
        raw: true,
      });
      return response.data.text();
    },
    placeholderData: (previous) => previous,
  });

  return (
    <div className="bg-base-200 relative flex h-full flex-col">
      {isFetching ? (
        <div className="absolute top-3 right-3 z-10">
          <Loading size="sm" />
        </div>
      ) : null}

      {html ? (
        // Sandboxed: this is tenant-authored template HTML rendered server-side,
        // and it has no reason to run scripts or reach back into the workbench.
        <iframe
          title="Template preview"
          srcDoc={html}
          sandbox=""
          className="min-h-0 w-full flex-1 border-0 bg-white"
        />
      ) : (
        <div className="flex flex-1 items-center justify-center text-sm">Drawing the page…</div>
      )}

      <Text className="shrink-0 px-3 py-2 text-sm">
        This is the template as it was last saved. Save in the editor to see a change here.
      </Text>
    </div>
  );
}
