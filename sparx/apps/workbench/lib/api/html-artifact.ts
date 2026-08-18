// Opening a server-rendered HTML artifact (an invoice print view, a frozen
// snapshot) in its own browser tab.
//
// The obvious thing — an <a href="https://api…/pdf" target="_blank"> — cannot
// work here: those routes require the Authorization header, and a plain browser
// navigation has no way to carry one. So the artifact is fetched with the
// token, wrapped in a blob URL, and the tab is pointed at that.
//
// The tab itself MUST be opened synchronously, before the first await. Popup
// blockers allow window.open only while a real user gesture is on the stack;
// open-after-fetch gets silently blocked and the click does nothing.

import { getTokenState } from './token';

export async function openServerHtml(path: string): Promise<void> {
  const tab = window.open('about:blank', '_blank');
  if (!tab) {
    throw new Error('Your browser blocked the new tab. Allow pop-ups for this site and retry.');
  }

  try {
    const state = await getTokenState();
    const response = await fetch(new URL(path, state.apiUrl), {
      headers: {
        authorization: `Bearer ${state.token}`,
        ...(state.propertyId ? { 'x-sparx-property-id': state.propertyId } : {}),
      },
    });
    if (!response.ok) {
      throw new Error(`The document could not be prepared (${String(response.status)}).`);
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    // replace(), not assignment: about:blank never enters the tab's history, so
    // its Back button doesn't lead to an empty page.
    tab.location.replace(url);
    // The blob must outlive navigation + render; a minute is comfortably past
    // both, and revoking reclaims the memory without touching the loaded page.
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 60_000);
  } catch (error) {
    // Never leave a stranded about:blank tab behind a failed fetch.
    tab.close();
    throw error;
  }
}
