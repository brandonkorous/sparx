'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { STORY_EXAMPLES } from '@wizeworks/story-schemas';
import { StoryProse } from './story-prose';
import { allTokens, storyPlainText, storyTokens, tokenSteps } from './story-tokens';
import styles from './hero-story.module.css';

/**
 * The hero's right column: the example stories from the story onboarding, typed out
 * one after another. This replaces the old device vignette — rather than mocking up a
 * product screen, the hero shows the actual first thing a new owner does, in the
 * actual grammar they'll do it in (the examples and the clause vocabulary are the
 * shipped ones, read from `@wizeworks/story-schemas`).
 *
 * Typing is the point, not decoration: an owner describes their business and watches
 * modules switch on as they say them, so the prose types at reading speed and each
 * chip lands whole — after a beat's pause, with a flash — the way a module switching
 * on is an event rather than a word being spelled.
 *
 * Every story is also rendered invisibly behind the live one, so the stage is always
 * as tall as the LONGEST story and typing never reflows the hero.
 */

/** Reading-speed prose — paced to be read along with, not raced through. */
const CHAR_MS = 38;
/** The beat before a chip lands — long enough to read as "…and that switches on X". */
const CHIP_MS = 260;
/** How long a finished story holds before the next one starts. A story's total time
 *  is its typing plus this, so the slower the typing, the longer each slide runs —
 *  this only sets the pause at the end. */
const HOLD_MS = 4400;
/** Reduced motion gets whole stories on a plain timer instead of typing. */
const STATIC_DWELL_MS = 8000;

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent): void => setReduced(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

/** The per-step delays for one story: one entry per reveal step, so the typing loop
 *  just reads off how long to wait before revealing step i. */
function stepDelays(idx: number): number[] {
  const example = STORY_EXAMPLES[idx];
  const tokens = example ? storyTokens(example.story) : null;
  if (!tokens) return [];
  return allTokens(tokens).flatMap((tok) =>
    tok.t === 'text' ? Array.from({ length: tokenSteps(tok) }, () => CHAR_MS) : [CHIP_MS]
  );
}

export function HeroStoryRotator(): ReactNode {
  const [idx, setIdx] = useState(0);
  const [step, setStep] = useState(0);
  const reduced = usePrefersReducedMotion();

  const delays = useMemo(() => stepDelays(idx), [idx]);
  const total = delays.length;
  const done = step >= total;

  // Type the current story, one step at a time. A per-step timeout (rather than one
  // interval) is what lets a chip pause longer than a character.
  useEffect(() => {
    if (reduced || done) return;
    const wait = delays[step] ?? CHAR_MS;
    const timer = setTimeout(() => setStep((s) => s + 1), wait);
    return () => clearTimeout(timer);
  }, [step, done, delays, reduced]);

  // Hold the finished story, then move on. `idx` is a dep so the hold restarts per
  // story rather than firing once and stranding the rotation.
  useEffect(() => {
    if (!reduced && !done) return;
    const timer = setTimeout(
      () => {
        setIdx((i) => (i + 1) % STORY_EXAMPLES.length);
        setStep(0);
      },
      reduced ? STATIC_DWELL_MS : HOLD_MS
    );
    return () => clearTimeout(timer);
  }, [done, reduced, idx]);

  return (
    <div>
      <ul className={styles.srOnly}>
        {STORY_EXAMPLES.map((ex) => (
          <li key={ex.label}>{storyPlainText(ex.story)}</li>
        ))}
      </ul>

      <div className={styles.stage} aria-hidden>
        {/* Sizers: every story at full length, invisible — they hold the stage open
            so the live one can type into a space that never resizes. */}
        {STORY_EXAMPLES.map((ex) => (
          <div key={ex.label} className={styles.sizer}>
            <StoryProse story={ex.story} />
          </div>
        ))}

        {STORY_EXAMPLES[idx] && (
          <div className={styles.live}>
            <StoryProse
              story={STORY_EXAMPLES[idx].story}
              revealed={reduced ? null : Math.min(step, total)}
            />
          </div>
        )}
      </div>

      <div className={styles.ticks} aria-hidden>
        {STORY_EXAMPLES.map((ex, i) => (
          <span key={ex.label} className={styles.tick}>
            <span
              className={styles.tickFill}
              style={{
                transform: `scaleX(${i < idx ? 1 : i === idx ? (total ? Math.min(step / total, 1) : 1) : 0})`,
              }}
            />
          </span>
        ))}
      </div>
    </div>
  );
}
