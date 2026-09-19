// Saving a file to the operator's disk from the browser.
//
// Two shapes, because a workbench download has two sources:
//
//   • `saveBlob` — bytes we already built in memory (a CSV assembled client-side
//     from data already loaded). No network, no token.
//   • `downloadServerFile` — an authenticated api-rest file route. A plain
//     `<a download href>` can carry NEITHER the Authorization header nor the
//     active property, so — exactly like `openServerHtml` — we fetch with the
//     token, then hand the bytes to `saveBlob`.
//
// ── The anchor that was never a link ─────────────────────────────────────────
//
// That second paragraph was already written here, and `components/download-
// button.tsx` was built anyway as `<Button render={<a href={path} download />}>`
// with a bare `/v1/...` path. Two things follow from that, and both of them are
// silent:
//
//   1. A bare path resolves against the CONSOLE origin, not the API's. The API
//      origin is only known at runtime, from `/api/token`, so no relative href
//      can ever reach it. localhost:3022 has no `/v1` route, so Next answered
//      with the console's own app shell and the browser saved 146KB of HTML as
//      `template.html`.
//   2. Even pointed at the right origin it would 401, because an anchor sends no
//      bearer token, and the browser would save the refusal as the file.
//
// Nothing threw. Nothing turned red. Every "Download what you have", every
// "Export", every "Spreadsheet" button in Stock handed back a file that opens in
// a text editor as a web page — eight call sites across two consoles. The whole
// on-ramp of "download what you have, count the shelves, upload it back" began
// with a file that had no shelves in it.
//
// So: one helper, used by the ONE button component, rather than a correct href
// at each call site. [[feedback_screen_over_a_function_nobody_calls]]
//
// ── Why the server's filename wins ───────────────────────────────────────────
//
// A blob URL has no name, so the caller must pass a fallback. It is a FALLBACK:
// the route names the file, and a caller's hardcoded name is how two periods of
// the same export save over each other. `content-disposition` is on the API's
// exposed-headers list precisely so this side can read it.

import { ApiError } from '@wizeworks/api-client';

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

export interface SavedFile {
  /** The name the file was actually saved under, so the caller can say it. */
  filename: string;
  /**
   * The response's own headers.
   *
   * A downloaded file cannot carry a warning: it is bytes on a disk, opened
   * later, in another program. Anything that changes how it should be READ —
   * rows the server left out, hours it could not price — has to ride beside it,
   * and this is the only place a caller can reach it.
   */
  headers: Headers;
}

/** The name the route gave the file, or the caller's fallback. */
function filenameFrom(headers: Headers, fallback: string): string {
  const disposition = headers.get('content-disposition') ?? '';
  // RFC 5987 form first: it is the one that survives a non-ASCII name.
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(disposition)?.[1];
  if (encoded) {
    try {
      return decodeURIComponent(encoded);
    } catch {
      // A malformed header is not worth failing a download over.
    }
  }
  return /filename="([^"]+)"/i.exec(disposition)?.[1] ?? fallback;
}

/**
 * Download an authenticated api-rest file route to disk.
 *
 * `path` is api-rest's own path (`/v1/inventory/imports/template?...`); the
 * origin is resolved at CLICK time, so a pane left open overnight downloads
 * from the right place with a live token.
 *
 * A refusal is rebuilt as a real `ApiError`, because the error path answers JSON
 * even where the success path answers a file — so `apiErrorMessage` shows the
 * server's own sentence exactly as it would for any other 4xx.
 */
export async function downloadServerFile(
  path: string,
  fallbackFilename: string
): Promise<SavedFile> {
  const state = await getTokenState();
  const response = await fetch(new URL(path, state.apiUrl), {
    headers: {
      authorization: `Bearer ${state.token}`,
      ...(state.propertyId ? { 'x-sparx-property-id': state.propertyId } : {}),
    },
  });

  if (!response.ok) {
    const detail = (await response.json().catch(() => null)) as {
      error?: { message?: string; code?: string; request_id?: string };
    } | null;
    throw new ApiError(response.status, {
      success: false,
      error: {
        message: detail?.error?.message ?? 'This file could not be downloaded.',
        code: detail?.error?.code ?? 'DOWNLOAD_FAILED',
        request_id: detail?.error?.request_id ?? '',
      },
    });
  }

  const filename = filenameFrom(response.headers, fallbackFilename);
  saveBlob(await response.blob(), filename);
  return { filename, headers: response.headers };
}
