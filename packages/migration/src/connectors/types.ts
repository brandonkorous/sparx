// The live-connection contract.
//
// A connector is the second way to get a tenant's data out of a competitor: instead
// of them exporting a file, we ask that platform's API for it directly. What it is
// NOT is a second importer. A connector's only job is to produce the SAME canonical
// rows a file adapter produces, one page at a time — everything downstream (the
// validator, the practice run, the processors, every screen in the workbench) is
// already built and does not change by a line.
//
// That is why `pull` returns rows rather than writing anything. The pages come back
// to the browser exactly as a parsed file does, the tenant sees the same validation
// report before anything is saved, and the same "nothing leaves this machine until
// you have looked at it" promise holds. A connector that wrote directly to the
// database would be a second, unreviewed path into a tenant's account.
//
// Network access is INJECTED rather than imported. `@sparx/migration` is isomorphic
// and dependency-free, and the connectors have to stay testable without a Shopify
// store to point them at — so every request goes through a `FetchLike` the caller
// supplies. In production that is api-rest's guarded fetch (which resolves the host
// and refuses anything private); in tests it is a function returning fixtures.

import type { CanonicalEntity, CanonicalRow } from '../canonical';

/** The three platforms with an API worth pulling from. Everything else on the roster
 *  is file-only, permanently and deliberately — see the note in ./index.ts. */
export type ConnectorSlug = 'shopify' | 'wordpress' | 'hubspot';

// ── The tiny slice of fetch we depend on ─────────────────────────────────────
//
// Deliberately structural and minimal: `globalThis.fetch` satisfies it as-is, and so
// does a four-line stub. Taking `Response` itself would drag the DOM lib into a
// package that has to build for a worker as well as a browser.

export interface HttpResponse {
  ok: boolean;
  status: number;
  headers: { get(name: string): string | null };
  text(): Promise<string>;
}

export interface HttpRequest {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  signal?: AbortSignal;
}

export type FetchLike = (url: string, init?: HttpRequest) => Promise<HttpResponse>;

// ── Credentials ──────────────────────────────────────────────────────────────

/**
 * One thing the tenant has to paste in.
 *
 * `pattern` is a regex SOURCE string, not a RegExp, because this whole descriptor is
 * serialised to the workbench over JSON — a RegExp would arrive as `{}`. The browser
 * checks it before we bother the vendor at all, which is the difference between "that
 * is not a Shopify token, it should start `shpat_`" and a bare 401.
 */
export interface CredentialField {
  key: string;
  label: string;
  help: string;
  placeholder?: string;
  /** Masked in the UI and never echoed back by the API. */
  secret: boolean;
  required: boolean;
  pattern?: string;
  patternHint?: string;
}

export type Credentials = Record<string, string>;

// ── What a connector can fetch ───────────────────────────────────────────────

export interface ConnectorResource {
  entity: CanonicalEntity;
  /** In the tenant's words, not the vendor's object names. */
  label: string;
  /** Roughly how many of the vendor's own records one page carries. Shown as
   *  progress, and the reason a 40,000-product catalogue does not look frozen. */
  pageSize: number;
  /** The credential field this resource needs. Absent means the required ones do. */
  requires?: string;
  /** Anything true about this resource the tenant should know before they start —
   *  a scope their token may not have, a limit the vendor imposes. */
  note?: string;
}

export interface ConnectorAccount {
  /** Which account we reached, in a form the tenant will recognise as theirs. */
  account: string;
  detail?: string;
}

export interface PullInput {
  credentials: Credentials;
  entity: CanonicalEntity;
  /** Opaque; hand back what the last page returned. Null starts at the beginning. */
  cursor: string | null;
  fetch: FetchLike;
}

export interface PullPage {
  entity: CanonicalEntity;
  rows: CanonicalRow[];
  /** Null when there is nothing left. */
  nextCursor: string | null;
  /**
   * Records read from the vendor on this page, before mapping.
   *
   * Not the same as `rows.length` and shown separately: one product with eight
   * variants is one record and nine rows, and a tenant watching "1,200 products read"
   * climb while the row count climbs faster should see both numbers rather than one
   * confusing one.
   */
  fetched: number;
}

export interface Connector {
  slug: ConnectorSlug;
  label: string;
  /** Vendor slugs this connector serves. One connector covers WooCommerce and
   *  WordPress, because underneath they are the same site with the same REST API. */
  vendors: readonly string[];
  /** Where the tenant goes to make the credential, in that platform's own menu
   *  language — the same principle as naming their export file verbatim. */
  instructions: readonly string[];
  fields: readonly CredentialField[];
  resources: readonly ConnectorResource[];
  /** One cheap call proving the credentials work, before anything long starts. */
  verify(input: { credentials: Credentials; fetch: FetchLike }): Promise<ConnectorAccount>;
  pull(input: PullInput): Promise<PullPage>;
}

/**
 * A connector as it crosses the wire — everything except the functions.
 *
 * The API serves this and the workbench renders the credential form from it, so
 * adding a field to a connector is one edit here rather than one here and one in a
 * form component that would drift from it.
 */
export interface ConnectorDescriptor {
  slug: ConnectorSlug;
  label: string;
  vendors: string[];
  instructions: string[];
  fields: CredentialField[];
  resources: ConnectorResource[];
}

export function describeConnector(connector: Connector): ConnectorDescriptor {
  return {
    slug: connector.slug,
    label: connector.label,
    vendors: [...connector.vendors],
    instructions: [...connector.instructions],
    fields: connector.fields.map((field) => ({ ...field })),
    resources: connector.resources.map((resource) => ({ ...resource })),
  };
}
