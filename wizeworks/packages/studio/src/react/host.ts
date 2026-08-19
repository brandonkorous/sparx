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
import type { EmailColorDefaults, EmailPaletteItem } from '@wizeworks/silicaui-builder/email';
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

/** Resolving what an email canvas draws, against the app's own sample recipient. */
export interface EmailPreviewHost {
  /** A bound node's value — `data: { kind: 'value', ref }` on the node. */
  resolveBinding?: (ref: string, attr?: string) => string | undefined;

  /**
   * An inline `{{…}}` merge tag whose body is not a bare dotted path —
   * `{{customer.firstName ?? "there"}}`, a formatter, an ESP's own grammar.
   *
   * The expression language belongs to the app, never to the engine: the engine
   * hands over whatever is between the braces, trimmed, and does nothing else
   * with it. Wire this to the SAME evaluator the send uses, or the canvas and
   * the inbox will disagree about what a fallback means — and a fallback is
   * exactly what stops a nameless customer reading "Hi  — thanks".
   */
  resolveExpression?: (expr: string) => string | undefined;
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
   * canvas that paints a business's site in someone else's colors until they
   * notice.
   */
  fallbackTheme: Theme;

  /**
   * The business this site belongs to, as a visitor would see it.
   *
   * Used wherever a preview would otherwise invent one. A brand board showing a
   * made-up bakery answers "what do these colors do"; the same board showing the
   * owner's own name answers "is this MY site", which is the only question they
   * are actually asking.
   */
  siteName?: string;

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
   * Ready-made email blocks offered ON TOP of silica's own eight primitives — a
   * summary card, a callout, a CTA an author drops in one move.
   *
   * A separate seam from `catalog` because it is a separate vocabulary: an email
   * block is an `EmailNode`, and offering one in the site palette (or a section
   * in the email palette) would produce a node the other document cannot hold.
   */
  emailCatalog?: () => EmailPaletteItem[];

  /**
   * The literal colours a NEW email block is seeded with.
   *
   * Literal, because email HTML cannot ship CSS custom properties — every colour
   * in a sent email is frozen at the moment it is authored. Supplying the
   * tenant's own resolved palette here is what makes a fresh button land on
   * brand instead of on silica's neutral grey.
   */
  emailColors?: EmailColorDefaults;

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
   * How an EMAIL canvas resolves what it draws.
   *
   * Its own pair, not the site's `resolveBinding`, because they read different
   * sample data: `customer.firstName` means the recipient of this email, and
   * resolving it against the site's preview root would print a plausible wrong
   * name — the failure that looks exactly like a correct one.
   */
  emailPreview?: EmailPreviewHost;

  /**
   * Extra sections for the inspector's Settings tab, for the things the app knows
   * about that the engine cannot — a page's address and search wording, a product
   * pin, a per-module editor.
   *
   * The context carries WHICH document, and whether this is its root, because the
   * most useful panel of all belongs to the document rather than to any node in it:
   * an author who selects the page itself expects to find its address there.
   *
   * `node` is undefined on an EMAIL document. Email's node vocabulary is not the
   * site's — an `EmailNode` is not addressable in the site's sense — so an email
   * pane asks only for the document-level panel, with `isRoot` true.
   */
  inspectorPanels?: (node: AddressableNode | undefined, ctx: InspectorContext) => ReactNode;

  /**
   * Draw one of the engine's own glyphs with the APP's icon set.
   *
   * The package deliberately owns no icon dependency — it renders silica's baked
   * Lucide markup so it can serve two brands that have picked different sets. That
   * floor is right for a package and wrong inside an app: a builder toolbar drawn
   * in Lucide sits beside a Save drawn in the app's own set, and the two glyph
   * families read as two products a few pixels apart.
   *
   * Supply this and the engine asks the app for every glyph it draws by name,
   * falling back to the baked set for anything the app does not recognise — so a
   * host answers for the chrome it cares about and leaves the rest alone. The names
   * are silica's own ('undo', 'monitor', 'sun', 'menu').
   *
   * The class name is handed over rather than wrapped around the result, because
   * an icon library sizes its own glyph: a `size-4` on a box around a FontAwesome
   * svg does nothing to the svg inside it.
   */
  renderIcon?: (name: string, className?: string) => ReactNode;

  /** Mint an id for a newly inserted node. Defaults to the engine's own. */
  makeId?: () => string;

  /** Called before a node is stamped in, so an app can rewrite a template. */
  onInsert?: (node: Node) => Node;
}
