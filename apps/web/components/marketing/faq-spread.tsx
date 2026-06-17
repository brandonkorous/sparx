'use client';

import { useState } from 'react';
import type { FaqItem } from './faq';

const SANS = 'var(--font-sans)';

/**
 * The FAQ "index + spread": a left rail of questions drives one answer panel.
 * Each rail item is a dot + the question; the active question's dot carries the
 * section accent (the module color), inactive dots are muted — sparx's signal
 * vocabulary doing the "you are here" job, no numbered counters. One answer at a
 * time keeps it compact while every question stays visible to skim.
 *
 * Client component for the selection state ONLY — <Faq> emits the FAQPage
 * JSON-LD server-side from the same items, so every question and answer stays
 * crawlable / answer-engine-extractable regardless of what's on screen. Stacks
 * to a single column (rail above panel) at ≤1024px.
 */
export function FaqSpread({ items, accent }: { items: FaqItem[]; accent: string }) {
  const [active, setActive] = useState(0);
  const current = items[active] ?? items[0];
  if (!current) return null;

  // Color the trailing "?" in the accent — the question-mark answer to sparx's
  // period "spark" — rather than appending a duplicate mark.
  const q = current.question;
  const hasMark = q.endsWith('?');

  return (
    <div className="mkt-faq-spread">
      <ul
        className="mkt-faq-rail"
        style={{
          listStyle: 'none',
          margin: 0,
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: '2px',
        }}
      >
        {items.map((item, i) => {
          const on = i === active;
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => setActive(i)}
                aria-pressed={on}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                  width: '100%',
                  textAlign: 'left',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '12px 14px',
                  borderRadius: '8px',
                  fontFamily: SANS,
                  fontSize: '15px',
                  lineHeight: '22px',
                  fontWeight: on ? 500 : 400,
                  color: on ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                  backgroundColor: on ? 'var(--color-bg-surface)' : 'transparent',
                  transition: 'color 0.15s ease, background-color 0.15s ease',
                }}
              >
                <span
                  aria-hidden
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 9999,
                    flexShrink: 0,
                    marginTop: '6px',
                    backgroundColor: on ? accent : 'var(--color-border-strong)',
                    transition: 'background-color 0.15s ease',
                  }}
                />
                {item.question}
              </button>
            </li>
          );
        })}
      </ul>

      <div
        style={{
          flex: 1,
          minWidth: 0,
          backgroundColor: 'var(--color-bg-surface)',
          border: '1px solid var(--color-border-default)',
          borderTop: `2px solid ${accent}`,
          borderRadius: '12px',
          padding: 'clamp(24px, 3vw, 40px)',
        }}
      >
        <h3
          style={{
            margin: 0,
            fontFamily: SANS,
            fontWeight: 500,
            fontSize: 'clamp(20px, 2.4vw, 26px)',
            letterSpacing: '-0.02em',
            lineHeight: 1.25,
            color: 'var(--color-text-primary)',
          }}
        >
          {hasMark ? q.slice(0, -1) : q}
          {hasMark ? <span style={{ color: accent }}>?</span> : null}
        </h3>
        <p
          style={{
            margin: '18px 0 0',
            fontFamily: SANS,
            fontSize: '15px',
            lineHeight: '26px',
            color: 'var(--color-text-secondary)',
            whiteSpace: 'pre-line',
          }}
        >
          {current.answer}
        </p>
      </div>
    </div>
  );
}
