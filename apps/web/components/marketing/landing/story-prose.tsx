import { type ReactNode } from 'react';
import {
  Briefcase,
  Car,
  Cpu,
  Dumbbell,
  Scissors,
  Shirt,
  Sparkles,
  Utensils,
  Warehouse,
} from 'lucide-react';
import type { StoryState } from '@sparx/story-schemas';
import { allTokens, storyTokens, tokenSteps, type StoryTokens, type Token } from './story-tokens';
import styles from './hero-story.module.css';

/**
 * One example story, told read-only — the marketing twin of the story onboarding's
 * editable canvas (apps/dashboard .../story/_components/story-canvas.tsx). Same
 * grammar, same module-tinted chips, same closing web address; none of the editing
 * (no popovers, no remove buttons, no dashed "+" slots), because a dead control on a
 * landing page is a promise the page can't keep. Both read their vocabulary and their
 * tint recipe from `@sparx/story-schemas`, so the homepage cannot drift from what
 * onboarding actually opens with.
 *
 * `revealed` is how many steps of the story have been told — the caller types the
 * story by walking it up (null = show the whole thing at once, which is how the
 * offscreen sizer copies and the reduced-motion path render).
 *
 * Deliberately not a `<Text>`/`<Badge>` composition: the chips are inline prose
 * tokens with their own geometry, the same bespoke element the composer owns.
 */

const INDUSTRY_ICONS: Record<string, typeof Sparkles> = {
  shirt: Shirt,
  utensils: Utensils,
  cpu: Cpu,
  car: Car,
  scissors: Scissors,
  dumbbell: Dumbbell,
  briefcase: Briefcase,
  warehouse: Warehouse,
  sparkles: Sparkles,
};

function TokenView({ tok, shown }: { tok: Token; shown: number }): ReactNode {
  if (tok.t === 'wbr') return <wbr />;
  if (tok.t === 'text') {
    const text = tok.s.slice(0, shown);
    return tok.mono ? <span className={styles.sfx}>{text}</span> : <>{text}</>;
  }
  if (shown < 1) return null;

  // Chips and boxes land whole and flash as they arrive — `flash` is a one-shot
  // animation, and since a token only mounts once per telling, mounting IS the cue.
  if (tok.t === 'box') {
    return (
      <span className={`${styles.slot} ${styles.flash} ${tok.mono ? styles.handle : ''}`}>
        {tok.s}
      </span>
    );
  }
  const Icon = tok.icon ? (INDUSTRY_ICONS[tok.icon] ?? Sparkles) : null;
  return (
    <span className={`${styles.tok} ${styles.flash}`} style={tok.tint}>
      {Icon && (
        <span className={styles.ico}>
          <Icon size={26} strokeWidth={1.8} aria-hidden />
        </span>
      )}
      <span>{tok.s}</span>
    </span>
  );
}

/** Walk a token group, spending the reveal budget in order. Returns what's left so
 *  the next group picks up exactly where this one stopped. */
function Group({ tokens, budget }: { tokens: Token[]; budget: number }): ReactNode {
  let left = budget;
  return (
    <>
      {tokens.map((tok, i) => {
        const cost = tokenSteps(tok);
        const shown = Math.max(0, Math.min(left, cost));
        // A zero-cost `wbr` shows once the telling has reached it — it spends
        // nothing, so `shown` can't speak for it.
        const reached = left > 0;
        left -= cost;
        if (tok.t === 'wbr') return reached ? <TokenView key={i} tok={tok} shown={0} /> : null;
        if (shown <= 0 && tok.t !== 'text') return null;
        return <TokenView key={i} tok={tok} shown={shown} />;
      })}
    </>
  );
}

function spent(tokens: Token[]): number {
  return tokens.reduce((n, tok) => n + tokenSteps(tok), 0);
}

export function StoryProse({
  story,
  revealed,
}: {
  story: StoryState;
  /** Steps told so far; null tells the whole story at once. */
  revealed?: number | null;
}): ReactNode {
  const tokens: StoryTokens | null = storyTokens(story);
  if (!tokens) return null;

  const full = revealed == null;
  const budget = full ? Number.POSITIVE_INFINITY : revealed;

  // The three groups are one continuous telling, so each spends what the previous
  // left. The caret rides whichever group is currently being typed into.
  const leadBudget = full ? budget : Math.max(0, budget - spent(tokens.body));
  const urlBudget = full ? budget : Math.max(0, leadBudget - spent(tokens.domainLead));
  const typing = !full && budget < spent(allTokens(tokens));
  const caret = <span className={styles.caret} aria-hidden />;

  return (
    <div className={styles.story}>
      <Group tokens={tokens.body} budget={budget} />
      {typing && leadBudget <= 0 && caret}

      {(full || leadBudget > 0) && (
        <span className={styles.domainLine}>
          <Group tokens={tokens.domainLead} budget={leadBudget} />
          {typing && urlBudget <= 0 && caret}

          {(full || urlBudget > 0) && (
            <span className={styles.url}>
              <Group tokens={tokens.domainUrl} budget={urlBudget} />
              {typing && urlBudget > 0 && caret}
            </span>
          )}
        </span>
      )}
    </div>
  );
}
