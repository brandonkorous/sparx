// How many pages are saved and not live yet, said once, or nothing at all.

export function stillWaiting(pages: number): string | null {
  if (pages <= 0) return null;
  return pages === 1
    ? '1 other page is saved and not live yet.'
    : `${String(pages)} other pages are saved and not live yet.`;
}
