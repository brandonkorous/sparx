// Saving a file to the operator's disk from the browser.
//
// Two shapes, because a workbench download has two sources:
//
//   • `saveBlob` — bytes we already built in memory (a CSV assembled client-side
//     from data already loaded). No network, no token.
//   • `downloadServerFile` — an authenticated api-rest file route (a form
//     attachment lives in the PRIVATE bucket and is served only through a Bearer-
//     authenticated, RLS-scoped route). A plain `<a download href>` can't carry
//     the Authorization header, so — exactly like `openServerHtml` — we fetch with
//     the token, then hand the bytes to `saveBlob`.

import { getTokenState } from './token';

/** Trigger a browser "save file" for a blob already held in memory. */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Revoke after the save has certainly been kicked off; immediate revoke can
  // race the browser's own read of the URL.
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 60_000);
}

/**
 * Download an authenticated api-rest file route to disk.
 *
 * The route sets its own `Content-Disposition`; `filename` here is the fallback
 * the browser saves under (a blob URL has no name of its own). Throws with a
 * human sentence on a failed fetch so the caller can toast it.
 */
export async function downloadServerFile(path: string, filename: string): Promise<void> {
  const state = await getTokenState();
  const response = await fetch(new URL(path, state.apiUrl), {
    headers: {
      authorization: `Bearer ${state.token}`,
      ...(state.propertyId ? { 'x-sparx-property-id': state.propertyId } : {}),
    },
  });
  if (!response.ok) {
    throw new Error(`This file could not be downloaded (${String(response.status)}).`);
  }
  saveBlob(await response.blob(), filename);
}
