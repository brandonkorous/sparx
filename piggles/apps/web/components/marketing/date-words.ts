/** "2026-09-30" as "September 30, 2026", fixed to UTC so the server and the
 *  reader's browser can never print different days. */
export function dayWords(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}
