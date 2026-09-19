// A PANE MUST NOT PRINT THE STORED WORD FOR A PLACE A SALE CAME FROM.
//
// EDIT THIS FILE WITH AN EDITOR, NEVER THROUGH A SHELL HEREDOC. A heredoc eats
// a backslash, and `\b` inside a template literal is a BACKSPACE character, not
// a word boundary — which is how a spelling guard once scanned 686 files and
// reported everything clean over four real drifts (issue 583). Every pattern
// below is `String.raw`.
//
// ── What this guards ─────────────────────────────────────────────────────────
//
// The console has ONE vocabulary for where a sale came from, in
// `lib/console/channels.ts`, written because Devi's single sale read four
// different ways across four panes (issue 260). `storefront` says "Your
// website"; `pos` says "At the till"; `admin` says "Added by hand".
//
// Two inventory panes never got the memo and printed the stored word:
//
//     Things that do not add up   The Ash Overshirt / via storefront
//     Why this number             On storefront
//
// Measured on 2026-09-16: 4 oversell rows across 2 businesses carried a channel,
// and every one of them said "storefront" on screen while the same sale said
// "Your website" on Money.
//
// ── How it reads the tree ────────────────────────────────────────────────────
//
// It looks for one shape only: a JSX expression whose WHOLE content is a path
// ending in `.channel`, in a child position. That is exactly "a raw channel
// slug is drawn here" and nothing else.
//
// An ATTRIBUTE is deliberately exempt (`value={draft.channel}` on a Select):
// there the raw value is the identity the form round-trips, and translating it
// would break the control. The `=` immediately before the brace is what tells
// the two apart.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SURFACES = join(__dirname, '..', '..', 'surfaces');

/** A JSX child whose entire content is `something.channel`. The character
 *  before the brace must not be `=`, which is what an attribute looks like. */
const RAW_CHANNEL = String.raw`(^|[^=])\{\s*([A-Za-z_$][\w$]*(?:\.[\w$]+)*\.channel)\s*\}`;

/** Blank a comment out without losing a single newline, so the line numbers a
 *  failure reports still point at the real line. */
function withoutComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (match) => match.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/[^\n]*/g, (match, lead: string) => lead + ' '.repeat(match.length - 1));
}

function tsxFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...tsxFiles(full));
      continue;
    }
    if (entry.endsWith('.tsx') && !entry.endsWith('.test.tsx')) out.push(full);
  }
  return out;
}

function rawChannelRenders(): { where: string; text: string }[] {
  const hits: { where: string; text: string }[] = [];
  for (const file of tsxFiles(SURFACES)) {
    const lines = withoutComments(readFileSync(file, 'utf8')).split('\n');
    lines.forEach((line, index) => {
      const found = new RegExp(RAW_CHANNEL, 'g').exec(line);
      if (!found) return;
      hits.push({
        where: `${file.slice(SURFACES.length + 1).replace(/\\/g, '/')}:${String(index + 1)}`,
        text: found[2] ?? line.trim(),
      });
    });
  }
  return hits;
}

describe('a channel slug never reaches the screen', () => {
  it('finds the shape it is looking for', () => {
    // The matcher, tested before anything trusts what it reports. A guard whose
    // pattern is broken passes on everything, which is worse than no guard.
    const pattern = new RegExp(RAW_CHANNEL);
    expect(pattern.test('<span>via {incident.channel}</span>')).toBe(true);
    expect(pattern.test('<Text>On {data.channel.channel}</Text>')).toBe(true);
    // A wrapped one is the fix, not the bug.
    expect(pattern.test('<span>{channelLabel(incident.channel)}</span>')).toBe(false);
    // An attribute is the form's own value and must stay the stored word.
    expect(pattern.test('<Select value={draft.channel} />')).toBe(false);
    // A test the pane still needs to be able to write.
    expect(pattern.test('{incident.channel ? (')).toBe(false);
  });

  it('scans the whole surfaces tree', () => {
    // The denominator, asserted. A scan whose root moved finds nothing and
    // reports everything clean (see [[feedback_structural_checks_go_blind]]).
    expect(tsxFiles(SURFACES).length).toBeGreaterThan(150);
  });

  it('never draws the stored word for a place', () => {
    expect(rawChannelRenders()).toEqual([]);
  });
});
