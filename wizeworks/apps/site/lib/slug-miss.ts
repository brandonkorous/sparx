// A public slug lookup that api-rest refuses is the same answer as one it cannot find.
// api-rest caps a slug at 255 (content) or 160 (builder) chars and answers longer ones with
// VALIDATION_ERROR; a page treating that as a crash 500'd on scanner paths (WW-3).

/** Is this error "nothing has that slug"? A slug too long for api-rest's schema is a VALIDATION_ERROR and means the same (WW-3). */
export function isSlugMiss(err: unknown): boolean {
  const code = (err as { code?: string } | null)?.code;
  return code === 'NOT_FOUND' || code === 'VALIDATION_ERROR';
}

/** A public slug read: a miss is null, and a stale preview token falls back to the published read. */
export async function readSlugOrNull<T>(
  fetchOnce: (withPreview: boolean) => Promise<T>,
  previewToken?: string
): Promise<T | null> {
  try {
    return await fetchOnce(true);
  } catch (err) {
    if (isSlugMiss(err)) return null;
    if ((err as { code?: string }).code !== 'UNAUTHORIZED' || !previewToken) throw err;
  }
  try {
    return await fetchOnce(false);
  } catch (err) {
    if (isSlugMiss(err)) return null;
    throw err;
  }
}
