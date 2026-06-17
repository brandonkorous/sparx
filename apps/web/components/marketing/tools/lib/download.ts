/**
 * Browser download helpers shared by every tool.
 *
 * The tools are deliberately 100% client-side — nothing is uploaded, so every
 * artifact (a generated PNG, an .ico bundle, an invoice PDF) is handed to the
 * user straight from an in-memory Blob. These wrap the object-URL dance so the
 * tool components don't each re-implement it (and so we never leak object URLs).
 */

/** Trigger a browser "save as" for an in-memory Blob. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  triggerDownload(url, filename);
  // Revoke on the next tick — Safari needs the URL live through the click.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Trigger a download for an already-built URL (object URL or data URL). */
export function triggerDownload(url: string, filename: string): void {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** Download a string as a text file (manifest JSON, SVG markup, HTML snippet). */
export function downloadText(
  text: string,
  filename: string,
  mime = 'text/plain;charset=utf-8'
): void {
  downloadBlob(new Blob([text], { type: mime }), filename);
}

/** Read a File/Blob as a data URL (used to inline logos into canvases/HTML). */
export function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}
