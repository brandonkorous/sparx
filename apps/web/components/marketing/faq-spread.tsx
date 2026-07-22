'use client';

import { useState } from 'react';
import type { FaqItem } from './faq';

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
      <ul className="mkt-faq-rail m-0 flex list-none flex-col gap-0.5 p-0">
        {items.map((item, i) => {
          const on = i === active;
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => setActive(i)}
                aria-pressed={on}
                // Inactive questions are still meant to be READ, so they get a
                // real ink token (`text-ink-muted`), not a mix into transparent.
                className={`text-body-sm flex w-full cursor-pointer items-start gap-3 rounded-lg border-none px-3.5 py-3 text-left transition-colors duration-150 ${
                  on ? 'bg-base-100 text-base-content font-medium' : 'text-ink-muted bg-transparent'
                }`}
              >
                <span
                  aria-hidden
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full transition-colors duration-150 ${
                    on ? '' : 'bg-base-content/30'
                  }`}
                  // The active dot carries the section accent, which is a
                  // per-section runtime value — hence still inline.
                  style={on ? { backgroundColor: accent } : undefined}
                />
                {item.question}
              </button>
            </li>
          );
        })}
      </ul>

      <div className="bg-base-100 border-base-300 min-w-0 flex-1 rounded-xl border p-[clamp(24px,3vw,40px)]">
        <h3 className="text-base-content m-0 text-[clamp(20px,2.4vw,26px)] leading-[1.25] font-medium tracking-[-0.02em]">
          {hasMark ? q.slice(0, -1) : q}
          {hasMark ? <span style={{ color: accent }}>?</span> : null}
        </h3>
        <p className="text-ink-muted text-body-sm mt-[18px] mb-0 whitespace-pre-line">
          {current.answer}
        </p>
      </div>
    </div>
  );
}
