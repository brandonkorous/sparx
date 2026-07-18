import { AUDIENCE, CLAUSE, TENSE, connector, industryOf, tintStyle } from '@sparx/story-schemas';
import type { StoryState } from '@sparx/story-schemas';

// The hero's story, flattened into the units it gets TOLD in. The onboarding
// composer renders a story all at once (it's a working surface); the hero types it,
// so it needs the same sentence as an ordered stream: prose the caret types out
// letter by letter, and chips/boxes that land whole — a module switching on is an
// event, not something you spell.
//
// Pure + framework-free so the rendering component stays a renderer: the grammar
// itself (clause order, Oxford commas, which phrase wears which module hue) still
// comes from @sparx/story-schemas, never from here.

export interface Tint {
  background: string;
  color: string;
}

export type Token =
  /** Prose between the chips — typed one character at a time. `mono` marks the
   *  address suffix, which is type-matched to the handle box beside it. */
  | { t: 'text'; s: string; mono?: boolean }
  /** A module-tinted clause chip — appears whole, then flashes. */
  | { t: 'chip'; s: string; tint: Tint; icon?: string }
  /** A boxed inline value (the dropship object slot, the web handle). */
  | { t: 'box'; s: string; mono?: boolean }
  /** An explicit break opportunity — costs no steps, renders a `<wbr>`. */
  | { t: 'wbr' };

export interface StoryTokens {
  /** The story proper — "I run a food shop for people, where they can…". */
  body: Token[];
  /** The closing address's lead-in, on its own line under the body. */
  domainLead: Token[];
  /** The address itself, kept whole on the line below the lead-in. */
  domainUrl: Token[];
}

/** Every token in telling order — the three groups are a LAYOUT split, not a
 *  sequencing one, so anything counting or reading the story walks them as one. */
export function allTokens(tokens: StoryTokens): Token[] {
  return [...tokens.body, ...tokens.domainLead, ...tokens.domainUrl];
}

/** How many reveal steps a token costs: prose is per-character, a `wbr` is a layout
 *  hint that isn't told at all, everything else lands in one. */
export function tokenSteps(tok: Token): number {
  if (tok.t === 'wbr') return 0;
  return tok.t === 'text' ? tok.s.length : 1;
}

export function totalSteps(tokens: StoryTokens): number {
  return allTokens(tokens).reduce((n, tok) => n + tokenSteps(tok), 0);
}

/** The whole story as one plain sentence. The typing animation is meaningless to a
 *  screen reader (and a half-typed live region is worse than meaningless), so the
 *  rotator hides the visual telling and offers this instead. */
export function storyPlainText(story: StoryState): string {
  const tokens = storyTokens(story);
  if (!tokens) return '';
  const say = (list: Token[]): string => list.map((tok) => ('s' in tok ? tok.s : '')).join('');
  return `${say(tokens.body)} ${say(tokens.domainLead)} ${say(tokens.domainUrl)}`;
}

const NEUTRAL: Tint = {
  background: 'color-mix(in oklch, var(--color-base-content) 9%, transparent)',
  color: 'var(--color-base-content)',
};

/** One clause → its chip, plus the boxed value when the clause has an object slot
 *  ("offer dropshipped [branded tote bags]"). */
function clauseTokens(id: string, story: StoryState): Token[] {
  const cl = CLAUSE[id];
  if (!cl) return [];
  const phrase = (cl.place === 'cust' ? cl.cust : cl.owner) ?? id;
  const out: Token[] = [{ t: 'chip', s: phrase, tint: tintStyle(cl.mod) }];
  if (cl.slot) {
    // An unfilled slot shows its placeholder — so `??` won't do, an empty string has
    // to fall back too (same rule as the composer's `phrase()`).
    const filled = story.slots[id];
    out.push(
      { t: 'text', s: ' ' },
      { t: 'box', s: filled && filled.length > 0 ? filled : cl.slot }
    );
  }
  return out;
}

/** A clause list spoken as one phrase — "A, B, and C". */
function clauseList(ids: string[], story: StoryState): Token[] {
  return ids.flatMap((id, i) => {
    const conn = connector(i, ids.length);
    const lead: Token[] = conn ? [{ t: 'text', s: conn }] : [];
    return [...lead, ...clauseTokens(id, story)];
  });
}

/**
 * Build the told form of a story. Returns null for an incomplete one — a half-told
 * story is worse than none, and every shipped example is complete by construction.
 */
export function storyTokens(story: StoryState): StoryTokens | null {
  if (!story.tense || !story.industry || !story.audience) return null;
  const ind = industryOf(story.industry);

  const body: Token[] = [
    { t: 'text', s: 'I ' },
    { t: 'chip', s: TENSE[story.tense].verb, tint: NEUTRAL },
    { t: 'text', s: ' ' },
    { t: 'chip', s: ind.noun, tint: tintStyle('builder'), icon: ind.icon },
    { t: 'text', s: ' for ' },
    {
      t: 'chip',
      s: AUDIENCE[story.audience].label,
      tint: tintStyle(AUDIENCE[story.audience].kind),
    },
  ];

  if (story.cust.length > 0) {
    body.push({ t: 'text', s: ', where they can ' }, ...clauseList(story.cust, story));
  }
  body.push({ t: 'text', s: '.' });

  story.lines.forEach((line, li) => {
    body.push({ t: 'text', s: li === 0 ? ' I’ll ' : ' I also ' }, ...clauseList(line, story));
    body.push({ t: 'text', s: '.' });
  });

  // The address breaks after the lead-in so the whole URL gets a line of its own —
  // it's the punchline of the story, and a handle wrapping mid-word reads as a typo.
  // The `wbr` is the ONLY place the URL may break: handle and suffix are each
  // nowrap, so a column too narrow for the whole address splits it at the dot
  // ("north-loop-fitness" / ".sparx.zone.") instead of mid-name. Width-independent
  // by design — the hero is a container-query layout, so its column can be narrow
  // while the viewport is wide, and no media query could see that.
  const domainLead: Token[] = [{ t: 'text', s: 'Find me at:' }];
  const domainUrl: Token[] = [
    { t: 'box', s: story.name, mono: true },
    { t: 'wbr' },
    { t: 'text', s: '.sparx.zone', mono: true },
    { t: 'text', s: '.' },
  ];

  return { body, domainLead, domainUrl };
}
