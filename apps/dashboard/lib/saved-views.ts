// Saved views — shared types + URL helpers for the dashboard's list "Views"
// control. The platform `/v1/views` API (services/api-rest) is the source of
// truth; these mirror its DTO so the client menu and the server actions share
// one shape. A view is a named snapshot of a list's query params, re-applied by
// navigating to `pathname?<params>`.

export interface SavedViewConfig {
  params: Record<string, string>;
}

export interface SavedView {
  id: string;
  target: string;
  name: string;
  config: SavedViewConfig;
  isDefault: boolean;
  shared: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSavedViewInput {
  target: string;
  name: string;
  config: SavedViewConfig;
  isDefault?: boolean;
  shared?: boolean;
}

/** Minimal read view over URLSearchParams — accepts Next's ReadonlyURLSearchParams. */
export type ParamReader = { get(name: string): string | null } | null;

/** Snapshot the view-defining params (search / filters / sort / view) out of the
 *  current URL — pagination and anything not in `paramKeys` is intentionally
 *  dropped so a saved view is portable and page-independent. */
export function snapshotParams(
  searchParams: ParamReader,
  paramKeys: readonly string[]
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of paramKeys) {
    const v = searchParams?.get(k);
    if (v) out[k] = v;
  }
  return out;
}

/** True when none of the view-defining params are present in the URL — i.e. the
 *  list is in its "bare" state and a default view may be auto-applied. */
export function hasNoViewParams(searchParams: ParamReader, paramKeys: readonly string[]): boolean {
  return !paramKeys.some((k) => searchParams?.get(k));
}

/** Build a `pathname?<params>` href from a saved view's params. */
export function viewHref(pathname: string, params: Record<string, string>): string {
  const qs = new URLSearchParams(params).toString();
  return qs ? `${pathname}?${qs}` : pathname;
}
