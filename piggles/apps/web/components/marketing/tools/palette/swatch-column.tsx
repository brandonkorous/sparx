'use client';

import { useState, type ReactNode } from 'react';
import { faLock } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { contrastRatio, describeColor, parseHex, readableInk, toHex } from '../lib/color';
import { ShadeRail } from './shade-rail';
import { SwatchActions } from './swatch-actions';
import { seenAs, type Vision } from './vision';
import { ROLE_JOBS, type Role } from './roles';
import type { Swatch } from './model';

/**
 * One slot: a color block, and the ink that goes on it in a band beneath.
 *
 * The role name at the top belongs to the SLOT, not to the color — drag a
 * swatch two places left and the labels stay where they are while the colors
 * move under them. That is the whole assignment mechanism, so the slot is also
 * the drag handle: the entire thing moves, not a grip in the corner.
 *
 * The ink band is a child of the slot rather than a row of its own, so it stays
 * aligned through a hover-grow and travels with its color on a drag.
 */
export function SwatchColumn({
  swatch,
  role,
  ink,
  foot,
  vision,
  removable,
  dragging,
  onCopy,
  onLock,
  onChange,
  onRemove,
  onGrab,
}: {
  swatch: Swatch;
  /** The silica role this SLOT carries, or null for a spare past the fifth. */
  role: Role | null;
  /**
   * This slot's `-content` — the ink the column ACTUALLY paints its text in.
   *
   * It used to paint whatever `readableInk` measured, which meant choosing an
   * ink in the band below changed the export and the preview and left the one
   * surface showing text on that color untouched. The card is the closest thing
   * to a real button anybody sees here; if it does not answer, the choice has no
   * feedback at all. Null on a spare, which has no ink to speak of.
   */
  ink: string | null;
  /** The ink band under the color — outside it, and aligned to it. */
  foot: ReactNode;
  vision: Vision;
  removable: boolean;
  dragging: boolean;
  onCopy: () => void;
  onLock: () => void;
  onChange: (hex: string) => void;
  onRemove: () => void;
  onGrab: (e: React.PointerEvent<HTMLDivElement>) => void;
}) {
  const [shading, setShading] = useState(false);
  const [copied, setCopied] = useState(false);

  const real = parseHex(swatch.hex) ?? { r: 0, g: 0, b: 0 };
  const shown = seenAs(swatch.hex, vision);

  // A spare has no ink of its own, so it falls back to whatever is readable on
  // it. Everything else paints in the ink this slot exports.
  const inkHex = ink ?? toHex(readableInk(real));
  const paint = seenAs(inkHex, vision);

  /**
   * How the pair actually reads, not what the maths would have picked.
   *
   * The caption said "takes dark text" — advice about the color, which was fine
   * while the ink was derived and starts contradicting the screen the moment
   * somebody chooses otherwise. It reports the pairing in front of them instead,
   * so an ink that does not work says so.
   */
  const ratio = contrastRatio(parseHex(inkHex) ?? real, real);
  const verdict =
    ratio >= 4.5 ? 'text reads at any size' : ratio >= 3 ? 'big text only' : 'text is hard to read';

  const copy = () => {
    onCopy();
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  return (
    <div
      onPointerDown={onGrab}
      className={`group flex min-w-0 flex-1 touch-none flex-col transition-[flex-grow] duration-200 select-none max-lg:flex-none lg:cursor-grab lg:hover:grow-[1.4] ${
        dragging ? 'z-10 grow-[1.4] lg:cursor-grabbing' : ''
      }`}
    >
      <div
        style={{ backgroundColor: shown, color: paint }}
        className="relative flex grow flex-col justify-between p-5 max-lg:h-32"
      >
        {shading ? <ShadeRail hex={swatch.hex} vision={vision} onPick={onChange} /> : null}

        <div className="relative flex items-start justify-between gap-3">
          <span>
            <span className="block font-mono text-base font-bold">{role ?? 'spare'}</span>
            <span className="block text-sm font-semibold">
              {role ? ROLE_JOBS[role] : 'No job — yours to use'}
            </span>
          </span>
          {/* Locked has to read without hovering — it is state, not a control. */}
          {swatch.locked ? (
            <Icon glyph={faLock} aria-hidden className="mt-1 size-4 shrink-0" />
          ) : null}
        </div>

        <div className="relative flex w-full flex-col gap-4 max-lg:flex-row max-lg:items-end max-lg:justify-between">
          <button
            type="button"
            onClick={copy}
            onPointerDown={(e) => e.stopPropagation()}
            className="order-2 text-left"
          >
            <span className="block font-mono text-2xl font-bold tracking-tight lg:text-3xl">
              {copied ? 'Copied' : swatch.hex}
            </span>
            <span className="mt-1 block text-sm font-semibold">
              {describeColor(real)} · {verdict}
            </span>
          </button>

          <div
            onPointerDown={(e) => e.stopPropagation()}
            className="order-1 transition-opacity lg:opacity-0 lg:group-focus-within:opacity-100 lg:group-hover:opacity-100"
          >
            <SwatchActions
              hex={swatch.hex}
              locked={swatch.locked}
              copied={copied}
              shading={shading}
              removable={removable}
              onCopy={copy}
              onLock={onLock}
              onShades={() => setShading((s) => !s)}
              onChange={onChange}
              onRemove={onRemove}
            />
          </div>
        </div>
      </div>

      {/* Stops the pointer so a click on the ink cell never starts a drag. */}
      <div onPointerDown={(e) => e.stopPropagation()}>{foot}</div>
    </div>
  );
}
