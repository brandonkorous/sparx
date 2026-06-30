'use client';

import { Fragment, type CSSProperties, type ReactNode } from 'react';
import { CLAUSE, TENSE, AUDIENCE, industryOf, type AudienceKey } from '../_lib/clauses';
import { flatUnused, type StoryState } from '../_lib/story-state';
import { tintStyle } from './colors';
import { GhostTok, ChipTok, ClauseChip, AddButton, AutoInput, IndustryIcon } from './story-tokens';
import { TenseMenu, IndustryMenu, AudienceMenu, ClauseListMenu } from './story-menus';
import styles from './story.module.css';

export interface StoryDispatch {
  setTense: (t: StoryState['tense']) => void;
  setIndustry: (slug: string) => void;
  setAudience: (a: AudienceKey) => void;
  addCust: (id: string) => void;
  addToLine: (li: number, id: string) => void;
  addNewLine: (id: string) => void;
  removeClause: (id: string) => void;
  swapClause: (oldId: string, newId: string) => void;
  setSlot: (id: string, v: string) => void;
  setName: (v: string) => void;
}

const NEUTRAL_TINT: CSSProperties = {
  background: 'color-mix(in oklch, var(--color-text-primary) 7%, transparent)',
  color: 'var(--color-text-muted)',
};
const audienceTint = (a: AudienceKey): CSSProperties => tintStyle(AUDIENCE[a].kind);

function conn(i: number, n: number): string {
  if (i === 0) return '';
  if (i === n - 1) return n > 2 ? ', and ' : ' and ';
  return ', ';
}

export function StoryCanvas({
  story,
  dispatch: d,
}: {
  story: StoryState;
  dispatch: StoryDispatch;
}): ReactNode {
  const nodes: ReactNode[] = [];
  let k = 0;
  const push = (n: ReactNode): void => {
    nodes.push(<Fragment key={k++}>{n}</Fragment>);
  };
  const T = (s: string): void => push(s);
  const done = (): ReactNode => <div className={styles.story}>{nodes}</div>;

  const chip = (id: string, voice: 'cust' | 'owner'): ReactNode => {
    const cl = CLAUSE[id];
    if (!cl) return null;
    return (
      <ClauseChip
        mod={cl.mod}
        phrase={(voice === 'cust' ? cl.cust : cl.owner) ?? id}
        onRemove={() => d.removeClause(id)}
        menu={(close) => (
          <ClauseListMenu
            story={story}
            ids={flatUnused(story)}
            current={id}
            onPick={(p) => d.swapClause(id, p)}
            close={close}
          />
        )}
      />
    );
  };
  const addMenu = (close: () => void): ReactNode => (
    <ClauseListMenu
      story={story}
      ids={flatUnused(story)}
      onPick={(p) => d.addNewLine(p)}
      close={close}
    />
  );
  const domain = (): void =>
    push(
      <span className={styles.domainLine}>
        Find me at{' '}
        <AutoInput
          mono
          value={story.name}
          onChange={d.setName}
          placeholder="your-name"
          ariaLabel="Your web address"
        />
        <span className={styles.sfx}>.sparx.zone</span>.
      </span>
    );

  T('I ');
  if (!story.tense) {
    push(
      <GhostTok
        label="want to start"
        menu={(c) => (
          <TenseMenu
            current={null}
            onPick={(t) => {
              d.setTense(t);
              c();
            }}
          />
        )}
      />
    );
    return done();
  }
  push(
    <ChipTok
      label={TENSE[story.tense].verb}
      style={NEUTRAL_TINT}
      menu={(c) => (
        <TenseMenu
          current={story.tense}
          onPick={(t) => {
            d.setTense(t);
            c();
          }}
        />
      )}
    />
  );
  T(' ');
  if (!story.industry) {
    push(
      <GhostTok
        label="a business"
        menu={(c) => (
          <IndustryMenu
            current={null}
            onPick={(s) => {
              d.setIndustry(s);
              c();
            }}
          />
        )}
      />
    );
    return done();
  }
  const ind = industryOf(story.industry);
  push(
    <ChipTok
      label={ind.noun}
      icon={<IndustryIcon icon={ind.icon} size={26} />}
      style={tintStyle('builder')}
      menu={(c) => (
        <IndustryMenu
          current={story.industry}
          onPick={(s) => {
            d.setIndustry(s);
            c();
          }}
        />
      )}
    />
  );
  T(' for ');
  if (!story.audience) {
    push(
      <GhostTok
        label="who"
        menu={(c) => (
          <AudienceMenu
            current={null}
            onPick={(a) => {
              d.setAudience(a);
              c();
            }}
          />
        )}
      />
    );
    return done();
  }
  push(
    <ChipTok
      label={AUDIENCE[story.audience].label}
      style={audienceTint(story.audience)}
      menu={(c) => (
        <AudienceMenu
          current={story.audience}
          onPick={(a) => {
            d.setAudience(a);
            c();
          }}
        />
      )}
    />
  );

  if (story.cust.length === 0 && story.lines.length === 0) {
    T('.');
    push(<AddButton kind="more" menu={addMenu} />);
    domain();
    return done();
  }

  // opening — "…where they can A, B, and C", with its own "+"
  if (story.cust.length) {
    T(', where they can ');
    story.cust.forEach((id, i) => {
      if (i) T(conn(i, story.cust.length));
      push(chip(id, 'cust'));
    });
  }
  const custIds = flatUnused(story, 'cust');
  if (custIds.length) {
    T(' ');
    push(
      <AddButton
        kind="in"
        menu={(c) => (
          <ClauseListMenu story={story} ids={custIds} onPick={(p) => d.addCust(p)} close={c} />
        )}
      />
    );
  }
  T('.');

  // each owner line is its OWN sentence — "I'll …" then "I also …"
  story.lines.forEach((line, li) => {
    T(li === 0 ? ' I’ll ' : ' I also ');
    line.forEach((id, i) => {
      if (i) T(conn(i, line.length));
      push(chip(id, 'owner'));
      const slot = CLAUSE[id]?.slot;
      if (slot) {
        T(' ');
        push(
          <AutoInput
            value={story.slots[id] ?? ''}
            onChange={(v) => d.setSlot(id, v)}
            placeholder={slot}
            ariaLabel="What you'll dropship"
          />
        );
      }
    });
    const ownerIds = flatUnused(story, 'owner');
    if (ownerIds.length) {
      T(' ');
      push(
        <AddButton
          kind="in"
          menu={(c) => (
            <ClauseListMenu
              story={story}
              ids={ownerIds}
              onPick={(p) => d.addToLine(li, p)}
              close={c}
            />
          )}
        />
      );
    }
    T('.');
  });

  if (flatUnused(story).length) {
    T(' ');
    push(<AddButton kind="next" menu={addMenu} />);
  }

  domain();
  return done();
}
