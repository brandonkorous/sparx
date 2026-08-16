/**
 * Getting a file out of the browser, and text onto the clipboard.
 *
 * Both are three lines of code and both have a failure mode that only appears in
 * the browsers you did not test, which is the entire reason they live in one
 * place rather than being written seventeen times.
 */

/**
 * Hand the user a file.
 *
 * The object URL is revoked on the next frame rather than immediately. Revoking
 * it in the same tick is the tidy-looking version and it races the download in
 * Safari — the click is dispatched, the URL is torn down, and the browser then
 * goes looking for data that is no longer there. It fails silently, on one
 * browser, for large files only, which is about the worst combination of
 * properties a bug can have.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  // Appending to the document is required by Firefox — a detached anchor's
  // click is ignored there, and only there.
  document.body.appendChild(a);
  a.click();
  a.remove();
  requestAnimationFrame(() => URL.revokeObjectURL(url));
}

export function downloadText(text: string, filename: string, type = 'text/plain'): void {
  downloadBlob(new Blob([text], { type: `${type};charset=utf-8` }), filename);
}

export function downloadDataUrl(dataUrl: string, filename: string): void {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/**
 * Copy text, with a fallback for the cases the modern API refuses.
 *
 * `navigator.clipboard` requires a secure context and rejects when the document
 * is not focused — which happens more than you would think, because a click on
 * a button inside an iframe or immediately after an alert can leave focus
 * somewhere unexpected. The old `execCommand` path still works everywhere and
 * costs a few lines, so a copy button that silently does nothing is a bug we
 * simply do not need to have.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the older path rather than reporting failure — the
    // fallback below succeeds in most of the cases that land here.
  }

  try {
    const area = document.createElement('textarea');
    area.value = text;
    // Off-screen rather than `display: none`: a hidden element cannot be
    // selected, so the copy would silently succeed at copying nothing.
    area.style.position = 'fixed';
    area.style.top = '-1000px';
    area.setAttribute('readonly', '');
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  } catch {
    return false;
  }
}

/** Copy rendered HTML so it pastes as formatted content rather than as source.
 *  This is what an email signature needs: pasting the markup into Gmail shows
 *  the markup, which is the single most common complaint about every signature
 *  generator on the internet. */
export async function copyRichHtml(html: string, plain: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.ClipboardItem && window.isSecureContext) {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([plain], { type: 'text/plain' }),
        }),
      ]);
      return true;
    }
  } catch {
    // Firefox historically refused ClipboardItem for text/html. Selecting a
    // live, rendered node and copying the selection works there and everywhere.
  }

  try {
    const host = document.createElement('div');
    host.innerHTML = html;
    host.style.position = 'fixed';
    host.style.top = '-10000px';
    document.body.appendChild(host);

    const range = document.createRange();
    range.selectNodeContents(host);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);

    const ok = document.execCommand('copy');
    selection?.removeAllRanges();
    host.remove();
    return ok;
  } catch {
    return copyText(plain);
  }
}

/** A filename that will not upset an operating system. Used wherever part of a
 *  name comes from something the user typed. */
export function safeFilename(name: string, fallback = 'piggles'): string {
  const cleaned = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return cleaned.length > 0 ? cleaned : fallback;
}
