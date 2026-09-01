'use client';

// How a pane that is ABOUT a document finds that document, and what it says when
// it cannot. History and Preview both work this way, and both were saying it in
// their own words.
//
// NEITHER PANE LOADS THE DOCUMENT, and that is deliberate: they read it out of
// the studio session, so they always describe the version somebody is actually
// editing rather than a second copy fetched behind their back.
//
// The cost of that decision is a state where the document is NAMED but not open,
// and it is not a rare one. Both panes open beside their document, both are kept
// in the saved arrangement, and a reload restores the pane before anything has
// opened the document it points at. That state was drawn as <PaneWaiting> — the
// mascot, spinning, `role="status"`, with an instruction underneath it. Nothing
// was loading and nothing ever would: it span until the tab was closed.
//
// It is the console's "nothing to show" state (components/pane-empty.tsx names
// this exact case), and it carries the way out rather than describing it. The
// address already names the document, so the button opens it — through the
// normal path, which keeps the one-loader rule intact.

import type { ReactNode } from 'react';
import type { DocumentKind, DocumentRef } from '@wizeworks/studio';
import { Button } from '@wizeworks/silicaui-react';
import { PaneEmpty } from '../../components/pane-empty';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import type { SurfaceParams } from '../../lib/surfaces/descriptor';

const MODULE = 'builder';

const KINDS = new Set<DocumentKind>(['page', 'layout', 'theme', 'component', 'email']);

/** The document an address names, or null when it names none. */
export function refFrom(params: SurfaceParams): DocumentRef | null {
  const { docKind, docId } = params;
  if (typeof docKind !== 'string' || typeof docId !== 'string') return null;
  return KINDS.has(docKind as DocumentKind) ? { kind: docKind as DocumentKind, id: docId } : null;
}

/**
 * Each kind in her words, and the pane that opens it.
 *
 * Two phrases rather than one noun because they sit in different sentences and a
 * single noun cannot serve both — "Your header and footer are not open" needs a
 * plural verb that "This page is not open" must not have.
 */
const DOCS: Record<
  DocumentKind,
  { closed: string; open: string; surface: string; param?: string }
> = {
  page: {
    closed: 'This page is not open',
    open: 'Open the page',
    surface: 'builder.page',
    param: 'pageId',
  },
  layout: {
    closed: 'Your header and footer are not open',
    open: 'Open the header and footer',
    surface: 'builder.layout',
  },
  theme: {
    closed: 'This look is not open',
    open: 'Open the look',
    surface: 'builder.theme',
    param: 'themeId',
  },
  component: {
    closed: 'This saved piece is not open',
    open: 'Open the saved piece',
    surface: 'builder.piece',
    param: 'pieceId',
  },
  email: {
    closed: 'This email is not open',
    open: 'Open the email',
    surface: 'builder.email',
    param: 'emailId',
  },
};

/**
 * The address names a document, but nothing has opened it.
 *
 * `ctx.open` re-focuses a pane that is already open on the same document rather
 * than making a second one, so after a reload this button brings the restored
 * canvas forward — which is what puts the document in the session and fills this
 * pane in. Beside, not in place, because having both on screen is the whole
 * reason this pane exists.
 */
export function DocumentNotOpen({
  ctx,
  ref_,
  icon,
  why,
}: {
  ctx: SurfaceContext;
  ref_: DocumentRef;
  /** The pane's own glyph, so the state still looks like the pane it is. */
  icon: ReactNode;
  /** Why this pane follows what is open, in the person's terms. */
  why: string;
}) {
  const doc = DOCS[ref_.kind];
  return (
    <PaneEmpty
      module={MODULE}
      icon={icon}
      title={doc.closed}
      description={why}
      actions={
        <Button
          color="module"
          onClick={() => {
            ctx.open(doc.surface, doc.param ? { [doc.param]: ref_.id } : undefined, {
              target: 'beside',
            });
          }}
        >
          {doc.open}
        </Button>
      }
    />
  );
}

/** The address names no document at all — a hand-typed link, or a stale layout. */
export function NoDocumentNamed({ icon, what }: { icon: ReactNode; what: string }) {
  return (
    <PaneEmpty
      module={MODULE}
      icon={icon}
      title="Nothing chosen"
      description={`Open this from the thing you want ${what}: a page, your header and footer, a look, a saved piece or an email.`}
    />
  );
}
