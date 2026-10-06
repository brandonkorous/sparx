// Words the installed design wrote, still on the page word for word.
//
// A starter design ships copy written before anyone knew the business: a hero that
// sells the PLATFORM ("Build it. Sell it. Grow it."), lines that talk to the OWNER
// ("Swap in your own products when you make this yours", "This template is a starting
// point, not a straitjacket"). Published unchanged, a diesel shop's customers read
// all of it as the shop's own voice. Gillett Diesel's homepage went live like that and
// nothing on any screen said so (sparx persona issue 046).
//
// The caller supplies what the design shipped (the install's baseline trees), so this
// stays pure. A line counts only when it is still EXACTLY the design's: once the owner
// changes a word it is theirs. Short labels ("Shop", "Contact us") are left alone; a
// design's button label is often the right one to keep.

import type { Node as SilicaNode } from '@wizeworks/silicaui-html';

import type { RawFinding } from './finding';
import type { StarterText } from './types';
import { childNodes, isBound, prop, type ContentNode, type DocumentInventory } from './walk';

/** Fewer words than this and a line is a label, not copy. */
const MIN_WORDS = 4;

/** How many of the lines a finding quotes, so the owner recognises them. */
const QUOTED = 2;

function normalize(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/** The copy a node carries ITSELF: its own string children and the copy props of a
 *  component atom. Not its descendants, which are lines of their own. */
function ownText(node: ContentNode): string {
  if (isBound(node)) return '';
  const parts: string[] = [];
  if (node.kind === 'component' || node.kind === 'host') {
    for (const key of ['label', 'text', 'title', 'heading', 'children']) {
      const value = prop(node, key);
      if (value) parts.push(value);
    }
  }
  for (const child of node.children ?? []) {
    if (typeof child === 'string' && child.trim()) parts.push(child);
  }
  return normalize(parts.join(' '));
}

function isCopy(line: string): boolean {
  return line.split(' ').filter(Boolean).length >= MIN_WORDS;
}

/** Every line of copy in a tree, for a caller building `StarterText` from the trees a
 *  design shipped. Uses the same reading as the check, so the two cannot disagree
 *  about what a line is. */
export function starterLinesOf(root: SilicaNode): string[] {
  const lines: string[] = [];
  const walk = (node: SilicaNode, depth: number): void => {
    if (depth > 64 || node.kind === 'outlet') return;
    const line = ownText(node);
    if (isCopy(line)) lines.push(line);
    for (const child of childNodes(node)) walk(child, depth + 1);
  };
  walk(root, 0);
  return lines;
}

function quote(line: string): string {
  return line.length > 60 ? `“${line.slice(0, 57).trimEnd()}…”` : `“${line}”`;
}

/**
 * One finding per authored tree (the page body, or the header and footer) that still
 * carries the design's words, pointing at the first such line. The frame's finding is
 * met on every page and merged into one row by `mergeFindings`.
 */
export function checkStarterText(
  inventory: DocumentInventory,
  starter: StarterText | undefined
): RawFinding[] {
  if (!starter) return [];
  const pageLines = new Set(starter.pages?.[inventory.page.id] ?? []);
  const frameLines = new Set(starter.frame ?? []);
  if (pageLines.size === 0 && frameLines.size === 0) return [];

  const hits = new Map<
    'page' | 'frame',
    { first: (typeof inventory.nodes)[number]; lines: string[] }
  >();
  for (const visited of inventory.nodes) {
    const scope = visited.origin.scope;
    if (scope !== 'page' && scope !== 'frame') continue;
    const shipped = scope === 'page' ? pageLines : frameLines;
    const line = ownText(visited.node);
    if (!isCopy(line) || !shipped.has(line)) continue;
    const hit = hits.get(scope);
    if (hit) hit.lines.push(line);
    else hits.set(scope, { first: visited, lines: [line] });
  }

  const findings: RawFinding[] = [];
  for (const [scope, { first, lines }] of hits) {
    const where = scope === 'frame' ? 'in your header and footer' : 'on this page';
    const count = lines.length === 1 ? 'One line' : `${String(lines.length)} lines`;
    const examples = lines.slice(0, QUOTED).map(quote).join(' and ');
    findings.push({
      rule: 'starter-text',
      severity: 'warning',
      title: 'Words from the starter design are still here',
      detail:
        `${count} ${where} ${lines.length === 1 ? 'is' : 'are'} still the design's own words, ` +
        `written before anyone knew your business, like ${examples}. ` +
        'Visitors read them as yours. Write your own, or delete what you do not need.',
      evidence: lines[0],
      origin: first.origin,
      nodeId: first.node.id ?? null,
      nodePath: first.nodePath,
    });
  }
  return findings;
}
