'use client';

import type { BlueprintChoice } from '@/lib/furnish';

// "How should it look" — the template shelf.
//
// Rendered only when the catalog answered. An empty list means the picker could
// not load, and the action falls back to the brand's own showcase, so a broken
// fetch costs a choice rather than a site.
//
// WHICH six appear, and why it is relevance rather than a vertical filter, is
// lib/looks.ts — that is the part that was getting a bakery offered skincare.

export function LookPicker({
  looks,
  selected,
  onSelect,
}: {
  looks: BlueprintChoice[];
  selected: string;
  onSelect: (key: string) => void;
}) {
  if (looks.length === 0) return null;

  return (
    <div>
      <h2 className="text-xl font-bold">How should it look?</h2>
      <p className="mt-1 text-base">
        Every one is a complete working site — shop, journal, bookings and all. You can rewrite any
        of it once you are in.
      </p>

      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {looks.map((b) => {
          const on = selected === b.key;
          return (
            <li key={b.key}>
              <label
                htmlFor={`look-${b.key}`}
                className={`rounded-box grid cursor-pointer grid-cols-[auto_1fr] items-start gap-x-4 border p-5 transition-colors ${
                  on ? 'border-module bg-module bg-soft' : 'border-base-300 bg-base-100'
                }`}
              >
                <input
                  type="radio"
                  id={`look-${b.key}`}
                  name="blueprintKey"
                  value={b.key}
                  checked={on}
                  onChange={() => onSelect(b.key)}
                  className="radio radio-module row-span-3 mt-0.5"
                />
                <span className="text-lg font-bold">{b.name}</span>
                <span className="text-base">{b.summary}</span>
                {b.preview ? (
                  // A plain img, not next/image: the card art is served by
                  // api-rest's media proxy on a host this app has no remote
                  // pattern for, and adding one is a wider change than this
                  // screen. Lazy, and decorative — the name beside it is the
                  // accessible label, so the alt is deliberately empty.
                  <img
                    src={b.preview}
                    alt=""
                    loading="lazy"
                    className="rounded-box border-base-300 mt-3 w-full border"
                  />
                ) : null}
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
