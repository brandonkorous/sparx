import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// The footer is in view on short pages, so a prefetching link there fires on every load.
const source = readFileSync(new URL('./site-footer.tsx', import.meta.url), 'utf8');

describe('site footer links', () => {
  it('never prefetch', () => {
    const links = source.match(/<Link\b[^>]*>/g) ?? [];
    expect(links.length).toBeGreaterThan(0);
    for (const tag of links) expect(tag).toContain('prefetch={false}');
  });
});
