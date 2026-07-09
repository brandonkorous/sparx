'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Sparkles } from 'lucide-react';
import { MODULE_BY_KEY } from '@/lib/modules';
import {
  CLAUSE,
  INDUSTRIES,
  INDUSTRY_BY_SLUG,
  TENSE,
  TENSE_ORDER,
  AUDIENCE,
  AUDIENCE_ORDER,
  type TenseKey,
  type AudienceKey,
} from '../_lib/clauses';
import { resolveModules, type StoryState } from '../_lib/story-state';
import { dotStyle } from './colors';
import { IndustryIcon } from './story-tokens';
import styles from './story.module.css';

const BADGE_STYLE = {
  background: 'color-mix(in oklch, var(--color-module-builder) 14%, transparent)',
  color: 'color-mix(in oklch, var(--color-module-builder) 58%, var(--color-base-content))',
};

function ClauseOption({
  id,
  story,
  active,
  onPick,
}: {
  id: string;
  story: StoryState;
  active?: boolean;
  onPick: () => void;
}): ReactNode {
  const cl = CLAUSE[id];
  if (!cl) return null;
  const mod = MODULE_BY_KEY[cl.mod];
  const on = resolveModules(story);
  const price = on[cl.mod] ? 'included' : `+$${mod?.price ?? 0}`;
  const phrase = cl.cust ?? cl.owner ?? id;
  const suggested =
    !!story.industry && (INDUSTRY_BY_SLUG[story.industry]?.suggest ?? []).includes(id);
  return (
    <button
      type="button"
      className={`${styles.opt}${active ? ` ${styles.optActive}` : ''}`}
      onClick={(e) => {
        e.stopPropagation();
        onPick();
      }}
    >
      <span className={styles.dot} style={dotStyle(cl.mod)} />
      <span className={styles.ot}>
        <span>
          {phrase}
          {cl.slot ? ' …' : ''}
        </span>
        <small>
          {mod?.name} · {price}
          {suggested && (
            <>
              {' · '}
              <span className={styles.sg}>suggested</span>
            </>
          )}
        </small>
      </span>
    </button>
  );
}

/** The add / inline-+ / swap menu — a FLAT list (no section headers). For a swap,
 *  `current` renders active at the top and selecting it is a no-op (close). */
export function ClauseListMenu({
  story,
  ids,
  current,
  onPick,
  close,
}: {
  story: StoryState;
  ids: string[];
  current?: string;
  onPick: (id: string) => void;
  close: () => void;
}): ReactNode {
  return (
    <>
      {current && <ClauseOption id={current} story={story} active onPick={close} />}
      {ids.map((id) => (
        <ClauseOption
          key={id}
          id={id}
          story={story}
          onPick={() => {
            onPick(id);
            close();
          }}
        />
      ))}
      {!current && ids.length === 0 && (
        <div className={styles.mhead}>That&apos;s the whole platform — nice.</div>
      )}
    </>
  );
}

export function TenseMenu({
  current,
  onPick,
}: {
  current: TenseKey | null;
  onPick: (t: TenseKey) => void;
}): ReactNode {
  return (
    <>
      {TENSE_ORDER.map((id) => (
        <button
          key={id}
          type="button"
          className={`${styles.opt}${current === id ? ` ${styles.optActive}` : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            onPick(id);
          }}
        >
          <span className={styles.ot}>
            <span>{TENSE[id].verb}</span>
            <small>{TENSE[id].sub}</small>
          </span>
        </button>
      ))}
    </>
  );
}

export function IndustryMenu({
  current,
  onPick,
}: {
  current: string | null;
  onPick: (slug: string) => void;
}): ReactNode {
  const [q, setQ] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  const hits = INDUSTRIES.filter(
    (i) => !q || `${i.name} ${i.noun}`.toLowerCase().includes(q.toLowerCase())
  );
  return (
    <>
      <input
        ref={inputRef}
        className={styles.filter}
        placeholder="Type your business…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onClick={(e) => e.stopPropagation()}
      />
      {hits.length > 0 ? (
        hits.map((i) => (
          <button
            key={i.slug}
            type="button"
            className={`${styles.opt}${current === i.slug ? ` ${styles.optActive}` : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              onPick(i.slug);
            }}
          >
            <span className={styles.badge} style={BADGE_STYLE}>
              <IndustryIcon icon={i.icon} size={16} />
            </span>
            <span className={styles.ot}>
              <span>{i.name}</span>
              <small>{i.noun}</small>
            </span>
          </button>
        ))
      ) : (
        <button
          type="button"
          className={styles.opt}
          onClick={(e) => {
            e.stopPropagation();
            onPick('generic');
          }}
        >
          <span className={styles.badge} style={BADGE_STYLE}>
            <Sparkles size={16} strokeWidth={1.8} />
          </span>
          <span className={styles.ot}>
            <span>Use “{q}”</span>
            <small>starts from the generic kit</small>
          </span>
        </button>
      )}
    </>
  );
}

export function AudienceMenu({
  current,
  onPick,
}: {
  current: AudienceKey | null;
  onPick: (a: AudienceKey) => void;
}): ReactNode {
  return (
    <>
      {AUDIENCE_ORDER.map((id) => (
        <button
          key={id}
          type="button"
          className={`${styles.opt}${current === id ? ` ${styles.optActive}` : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            onPick(id);
          }}
        >
          <span className={styles.dot} style={dotStyle(AUDIENCE[id].kind)} />
          <span className={styles.ot}>
            <span>{AUDIENCE[id].label}</span>
            <small>{AUDIENCE[id].sub}</small>
          </span>
        </button>
      ))}
    </>
  );
}
