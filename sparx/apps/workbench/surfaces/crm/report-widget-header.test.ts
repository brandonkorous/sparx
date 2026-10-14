// A board card's controls wrap under its words when there is no room beside them
// (persona issue 262). On a phone they squeezed the words and pushed "remove" off.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const source = readFileSync(fileURLToPath(new URL('./report-widget.tsx', import.meta.url)), 'utf8');

describe('the board card header', () => {
  it('wraps, and keeps the words at a readable width', () => {
    const header =
      /<Card className="flex h-full flex-col gap-3 p-4"[^>]*>\s*<div className="([^"]+)">\s*<div className="([^"]+)">/.exec(
        source
      );
    expect(header).not.toBeNull();
    expect(header?.[1]).toContain('flex-wrap');
    expect(header?.[2]).toMatch(/min-w-/);
    expect(header?.[2]).toContain('flex-1');
  });

  it('draws its numbers in the house table, which spaces its columns', () => {
    expect(source).not.toContain('<table');
    expect(source).toContain('<Table size="sm"');
  });
});
