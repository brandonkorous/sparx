// The domain seam — everything the engine cannot know and the app must supply.
//
// The split is the same one that made silica's own host worth having: the ENGINE
// knows what a node is and how to edit it; the HOST knows what a binding means,
// what blocks this business can insert, what a cart looks like on a canvas, and
// which classes this tenant is allowed to write. Keeping that out here is what
// lets one editor serve a bakery and a parts distributor without a branch.
//
// Every field is optional but `fallbackTheme`. A host that supplies nothing still
// gets a working editor over the built-in silica catalog — which is what makes
// this package testable without an app around it.

import type { HostNode, Node, Theme } from '@wizeworks/silicaui-html';
import type { PaletteGroup } from '@wizeworks/silicaui-builder/react';
import type { ReactNode } from 'react';
import type { DocumentKind, DocumentRef } from '../documents/types';
import type { AddressableNode } from '../tree/walk';

/** An image the author picked out of the app's own media library. */
export interface PickedAsset {
  url: string;
  alt?: string;
}

/** Why a class string was refused, in words an author can act on. */
export interface ClassDenial {
  ok: false;
  reason: string;
}

export type ClassVerdict = { ok: true } | ClassDenial;

/** Which document an inspector panel is being asked for, and where in it. */
export interface InspectorContext {
  doc: DocumentRef;
  /** True for the document's own root — where its settings belong. */
  isRoot: boolean;
}

/** What the app adds to — and takes out of — the Insert palette for one document. */
export interface CatalogScope {
  /** Groups to offer beyond silica's own catalog. */
  extend?: PaletteGroup[];
  /** Item or group keys this document has no business offering. */
  hide?: string[];
}

export interface StudioHost {
  /**
   * The theme a site wears before anyone opens the theme builder — the app
   * derives it from the tenant's brand. Required, because the alternative is a
   * canvas that paints a business's site in someone else's colours until they
   * notice.
   */
  fallbackTheme: Theme;

  /**
   * What this document may insert.
   *
   * Asked per KIND, because a layout and a page are offered different things: a
   * header is chrome and a pricing table is page content, and a palette that
   * offers both to both leaves the author to work out which is which. Hiding is
   * scoping, not censorship — a hidden item is one that would be wrong HERE, and
   * is still one pane away in the document it belongs to.
   */
  catalog?: (kind: DocumentKind) => CatalogScope;

  /**
   * Draw a pinned functional core — a cart, a checkout, the brand mark — on the
   * canvas. Omit it and one renders as a labelled placeholder, which is honest
   * but tells an author nothing about the footprint they are designing around.
   */
  renderHostNode?: (node: HostNode) => ReactNode;

  /**
   * Open the app's media library for an image field.
   *
   * Without it the image field is a bare URL textbox, which asks a non-technical
   * business owner to know what a URL is in order to put their own photograph on
   * their own site.
   */
  pickAsset?: () => Promise<PickedAsset | null>;

  /** The tenant's class policy, tightening the engine's floor. */
  validateClass?: (className: string) => ClassVerdict;

  /**
   * Resolve a data binding to something showable. The canvas draws sample data so
   * a bound heading reads as a real product name rather than as `{{…}}`.
   */
  resolveBinding?: (ref: string, attr?: string) => string | undefined;

  /**
   * Extra sections for the inspector's Settings tab, for the things the app knows
   * about that the engine cannot — a page's address and search wording, a product
   * pin, a per-module editor.
   *
   * The context carries WHICH document, and whether this is its root, because the
   * most useful panel of all belongs to the document rather than to any node in it:
   * an author who selects the page itself expects to find its address there.
   */
  inspectorPanels?: (node: AddressableNode, ctx: InspectorContext) => ReactNode;

  /** Mint an id for a newly inserted node. Defaults to the engine's own. */
  makeId?: () => string;

  /** Called before a node is stamped in, so an app can rewrite a template. */
  onInsert?: (node: Node) => Node;
}
