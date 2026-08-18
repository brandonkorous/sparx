'use client';

import { Fragment, type ReactNode } from 'react';
import { CLAUSE, TENSE, AUDIENCE, connector as conn, industryOf } from '@wizeworks/story-schemas';
import {
  flatUnused,
  type StoryDispatch,
  type StoryState,
} from '../../../lib/onboarding/story-state';
import { GhostTok, ChipTok, ClauseChip, AddButton, AutoInput, IndustryIcon } from './story-tokens';
import { TenseMenu, IndustryMenu, AudienceMenu, ClauseListMenu } from './story-menus';
import styles from './story.module.css';

// The interactive sentence. It renders the story as tappable prose:
//   "I [tense] [industry] for [audience], where they can …. I'll …. Find me at …."
// Every colored word is a chip you tap to change; ghost slots invite the next
// choice; round "+" buttons add clauses; inline inputs take the dropship object and
// the web handle. It is a pure projection of `StoryState` through the shared grammar,
// so the summary plan beside it always mirrors exactly what's on screen.

export type { StoryDispatch };

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
      neutral
      label={TENSE[story.tense].verb}
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
      module="builder"
      label={ind.noun}
      icon={<IndustryIcon icon={ind.icon} size={26} />}
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
      module={AUDIENCE[story.audience].kind}
      label={AUDIENCE[story.audience].label}
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

  // Each owner line is its OWN sentence, and its lead verb tracks the opening tense so
  // the voice stays consistent across the whole story: a business you already RUN speaks
  // in the present ("I share …. I also remember …"), one you WANT TO START speaks in
  // intent ("I’ll share …. I’ll also remember …") — parallel to the opening, never a
  // present-tense "I also" bolted onto a future "I’ll".
  const present = story.tense === 'current';
  const firstLead = present ? ' I ' : ' I’ll ';
  const alsoLead = present ? ' I also ' : ' I’ll also ';
  story.lines.forEach((line, li) => {
    T(li === 0 ? firstLead : alsoLead);
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
