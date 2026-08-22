'use client';

// The site as a visitor would see it — inside the console, beside the thing being
// edited.
//
// It shows the SAVED draft, which is the honest boundary and worth saying on screen:
// the storefront renders what the server has, so anything typed and not saved is not
// in here. The pane offers Save-and-refresh rather than pretending otherwise.
//
// The header, the look and a saved piece have no address of their own — they are
// underneath every page — so previewing one shows the home page and says so, rather
// than showing a blank frame for a document that has no URL.

import { useCallback, useEffect, useState } from 'react';
import { Alert, Button } from '@wizeworks/silicaui-react';
import { faArrowsRotate } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import type { StudioDoc } from '@wizeworks/studio';
import { PaneWaiting } from '../../components/pane-waiting';
import { useActivePropertyId } from '../../lib/api/shell-data';
import { useRecordSamplePaths, useSiteOrigin } from '../../lib/studio/site-data';
import {
  previewPath,
  previewUrl,
  useMintPreviewToken,
  type SitePreviewTarget,
} from '../../lib/studio/site-preview';
import { PreviewFrame, type PreviewWidth } from './preview-frame';

/** Which page stands in for a document that has no address of its own. */
function pathFor(doc: StudioDoc, samples: Record<string, string> | undefined): string {
  return doc.kind === 'page' ? previewPath(doc.slug, samples) : '/';
}

/** Said only when the document has no address — otherwise it would state the obvious. */
function standInNote(doc: StudioDoc): string | null {
  if (doc.kind === 'layout')
    return 'Your header and footer wrap every page, so this is the home page.';
  if (doc.kind === 'theme') return 'Your look applies to every page, so this is the home page.';
  if (doc.kind === 'component')
    return 'A saved piece has no address of its own, so this is the home page.';
  return null;
}

/**
 * The address to show, re-minted whenever it changes.
 *
 * A token is short-lived, and a stale one renders the PUBLISHED site while the pane
 * claims to be showing the draft — the worst possible failure for this screen.
 */
function usePreviewAddress(target: SitePreviewTarget | null, path: string) {
  const mint = useMintPreviewToken();
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      const { token } = await mint.mutateAsync();
      setUrl(previewUrl(target, token, path));
    } catch {
      setFailed(true);
    }
    // `mint` is a fresh object each render; the inputs that matter are the address.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, path]);

  useEffect(() => {
    void load();
  }, [load]);

  return { url: failed ? null : url, busy: mint.isPending, reload: load };
}

export function PreviewSite({ doc }: { doc: StudioDoc }) {
  const target = useSiteOrigin(useActivePropertyId());
  const samples = useRecordSamplePaths();
  const [width, setWidth] = useState<PreviewWidth>('full');

  const path = pathFor(doc, samples.data);
  const address = usePreviewAddress(target.data ?? null, path);
  const note = standInNote(doc);

  if (target.isPending) return <PaneWaiting label="Finding your website…" />;
  if (!target.data) return <NoAddress />;

  return (
    <div className="bg-base-200 flex h-full min-h-0 flex-col">
      <Toolbar path={path} busy={address.busy} onRefresh={() => void address.reload()} />
      {note ? (
        <p className="text-base-content border-base-300 shrink-0 border-b px-3 py-2 text-sm">
          {note}
        </p>
      ) : null}
      <PreviewFrame
        url={address.url}
        width={width}
        onWidth={setWidth}
        label="Your website"
        onRetry={() => void address.reload()}
      />
    </div>
  );
}

function Toolbar({
  path,
  busy,
  onRefresh,
}: {
  path: string;
  busy: boolean;
  onRefresh: () => void;
}) {
  return (
    <div className="border-base-300 flex shrink-0 flex-wrap items-center gap-2 border-b px-2 py-1.5">
      <span className="text-base-content truncate text-sm">{path}</span>
      <Button
        size="sm"
        shape="square"
        className="ml-auto"
        aria-label="Refresh"
        title="Show the latest saved version"
        disabled={busy}
        onClick={onRefresh}
      >
        <Icon glyph={faArrowsRotate} className="size-4" aria-hidden />
      </Button>
    </div>
  );
}

function NoAddress() {
  return (
    <div className="bg-base-200 h-full overflow-auto p-4">
      <Alert color="warning">
        This site has no web address yet, so there is nothing to show a visitor. Connect a domain
        and this will come to life.
      </Alert>
    </div>
  );
}
