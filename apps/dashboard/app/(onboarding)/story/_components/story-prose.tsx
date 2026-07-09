'use client';

import { Fragment, type CSSProperties, type ReactNode } from 'react';
import { CLAUSE, TENSE, AUDIENCE, industryOf } from '../_lib/clauses';
import { handleSlug, type StoryState } from '../_lib/story-state';
import { tintStyle } from './colors';
import { IndustryIcon } from './story-tokens';
import styles from './story.module.css';

// A READ-ONLY render of a story's prose — the colored sentence, no menus / × / +.
// Used to preview the example stories before the owner starts their own.

const NEUTRAL_TINT: CSSProperties = {
  background: 'color-mix(in oklch, var(--color-base-content) 7%, transparent)',
  color: 'color-mix(in oklch, var(--color-base-content) 60%, transparent)',
};

function conn(i: number, n: number): string {
  if (i === 0) return '';
  if (i === n - 1) return n > 2 ? ', and ' : ' and ';
  return ', ';
}

function Chip({ mod, children }: { mod: string; children: ReactNode }): ReactNode {
  return (
    <span className={styles.tok} style={tintStyle(mod)}>
      {children}
    </span>
  );
}

export function StoryProse({ story }: { story: StoryState }): ReactNode {
  const nodes: ReactNode[] = [];
  let k = 0;
  const push = (n: ReactNode): void => {
    nodes.push(<Fragment key={k++}>{n}</Fragment>);
  };
  const T = (s: string): void => push(s);

  const ind = industryOf(story.industry);
  T('I ');
  push(
    <span className={styles.tok} style={NEUTRAL_TINT}>
      {story.tense ? TENSE[story.tense].verb : 'want to start'}
    </span>
  );
  T(' ');
  push(
    <span className={styles.tok} style={tintStyle('builder')}>
      <span className={styles.ico}>
        <IndustryIcon icon={ind.icon} size={26} />
      </span>
      {ind.noun}
    </span>
  );
  if (story.audience) {
    T(' for ');
    push(
      <span className={styles.tok} style={tintStyle(AUDIENCE[story.audience].kind)}>
        {AUDIENCE[story.audience].label}
      </span>
    );
  }

  if (story.cust.length) {
    T(', where they can ');
    story.cust.forEach((id, i) => {
      const cl = CLAUSE[id];
      if (!cl) return;
      if (i) T(conn(i, story.cust.length));
      push(<Chip mod={cl.mod}>{cl.cust ?? id}</Chip>);
    });
  }
  T('.');

  story.lines.forEach((line, li) => {
    T(li === 0 ? ' I’ll ' : ' I also ');
    line.forEach((id, i) => {
      const cl = CLAUSE[id];
      if (!cl) return;
      if (i) T(conn(i, line.length));
      push(<Chip mod={cl.mod}>{cl.owner ?? id}</Chip>);
      if (cl.slot) {
        const filled = story.slots[id];
        T(' ');
        push(<span className={styles.slot}>{filled && filled.length > 0 ? filled : cl.slot}</span>);
      }
    });
    T('.');
  });

  push(
    <span className={styles.domainLine}>
      Find me at <span className={styles.handle}>{handleSlug(story.name) || 'your-name'}</span>
      <span className={styles.sfx}>.sparx.zone</span>.
    </span>
  );

  return <div className={styles.story}>{nodes}</div>;
}
