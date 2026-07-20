// The pane descriptor — the workbench's unit of "a thing you can look at".
//
// This is the inversion that defines the app. The dashboard is ROUTE-driven: a
// URL names a page, and whoever wrote that page decided what appears on it and
// beside it. The workbench is DESCRIPTOR-driven: a descriptor names one surface,
// the operator decides where it sits and what sits next to it.
//
// The governing rule that falls out of this, and the one every surface must
// obey: THE WORKBENCH OFFERS SURFACES, NEVER COMPOSITIONS. No surface may
// hardcode a two-pane layout. An invoice editor does not own a preview panel —
// it offers "open preview", which opens a pane, which the operator puts wherever
// they want, or never opens at all. The moment a surface renders a splitter it
// has taken a decision back from the user that this app exists to give them.
//
// Descriptors are the serialization boundary for everything: layout persistence,
// cross-window transfer, deep links, and the command palette all speak
// descriptors and nothing else. So a descriptor MUST be a plain JSON value —
// no functions, no class instances, no React nodes.

/** Params are always strings so a descriptor round-trips through JSON and a URL unchanged. */
export type SurfaceParams = Readonly<Record<string, string>>;

export interface PaneDescriptor {
  /** Unique per open pane. Two panes may share a surface+params (a deliberate side-by-side compare). */
  readonly id: string;
  /** Key into the surface registry, e.g. `commerce.orders.list`. */
  readonly surface: string;
  readonly params?: SurfaceParams;
  /**
   * Operator-set tab label. Absent means "derive from the surface", which is the
   * normal case — an explicit title survives only because a user renamed the tab.
   */
  readonly title?: string;
}

/** Mints a pane id. Random, not a counter — ids are persisted AND used as dock keys. */
export function mintPaneId(): string {
  return `p_${crypto.randomUUID().slice(0, 12)}`;
}

export function createDescriptor(
  surface: string,
  params?: SurfaceParams,
  title?: string
): PaneDescriptor {
  return { id: mintPaneId(), surface, params, title };
}

/**
 * Identity of what a pane SHOWS, ignoring which pane instance shows it. Used to
 * find an already-open pane before opening a duplicate, and to enforce
 * `singleton` surfaces.
 */
export function descriptorKey(descriptor: PaneDescriptor): string {
  const params = descriptor.params;
  if (!params) return descriptor.surface;
  const stable = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');
  return stable ? `${descriptor.surface}?${stable}` : descriptor.surface;
}

/**
 * Encodes a descriptor for a deep link (`?open=`). The workbench is an
 * application, not a document, so the URL does not track live layout — but a
 * single shareable "open this surface" link is genuinely useful, and it is how
 * a notification or an email lands someone on the right pane.
 */
export function encodeDescriptor(descriptor: PaneDescriptor): string {
  return descriptorKey(descriptor);
}

export function decodeDescriptor(encoded: string): PaneDescriptor | null {
  const [surface, query] = encoded.split('?', 2);
  if (!surface) return null;
  if (!query) return createDescriptor(surface);

  const params: Record<string, string> = {};
  for (const [key, value] of new URLSearchParams(query)) params[key] = value;
  return createDescriptor(surface, params);
}
