'use client';

import { useState } from 'react';
import { PaletteEditor } from './palette/editor';
import { ExportPanel } from './palette/export-panel';
import { Pairs } from './palette/pairs';
import { Preview } from './palette/preview';
import { usePalette } from './palette/use-palette';
import { assign, ROLE_JOBS, ROLE_ORDER, type ContentInk, type Role } from './palette/roles';
import { cssVars } from './palette/code';
import { MAX_LINE_VALUE, useReportToolResult } from './tool-result-context';
import type { Vision } from './palette/vision';
import type { Scheme } from './palette/generate';

/**
 * The color palette maker.
 *
 * ── THE PALETTE IS THE PAGE ─────────────────────────────────────────────────
 *
 * This started as a form on the left and a card of swatches on the right, which
 * is the shape of every other tool here and the wrong shape for this one. You do
 * not fill a palette in; you play with it until it is right, and that wants the
 * colors occupying the screen, the space bar re-rolling them, and everything
 * else out of the way until you reach for it.
 *
 * ── AND THEN IT ANSWERS THE QUESTION A GENERATOR NORMALLY DUCKS ─────────────
 *
 * Five hexes are not a design. The moment somebody has a set they like, the next
 * thing they need to know is which one is the button and which one is the
 * writing — so every slot carries a silica role, dragging a color into a slot
 * gives it that job, and the palette is immediately shown on a shop page, a
 * phone and an invoice. That is the part a business owner came for; the codes
 * underneath are for whoever they forward it to.
 */
export function PaletteTool() {
  const [scheme, setScheme] = useState<Scheme>('balanced');
  const [vision, setVision] = useState<Vision>('normal');
  const [ink, setInk] = useState<ContentInk>({});

  const p = usePalette(scheme);
  const roles = assign(p.palette, ink);

  /** Dropping an override restores silica's measured answer rather than freezing
   *  today's value, so it keeps tracking a color that changes underneath it. */
  const resetInk = (role: Role) => setInk(({ [role]: _dropped, ...rest }) => rest);

  // A palette found by pressing space is gone the second the tab closes. Each
  // color is labeled by the JOB it was given, never by its slot name: a printer
  // can act on "buttons and links" and cannot act on "primary".
  const css = cssVars(p.palette, roles);
  useReportToolResult({
    lines: [
      ...ROLE_ORDER.flatMap((role, i) => {
        const hex = p.palette[i]?.hex;
        return hex ? [{ label: ROLE_JOBS[role], value: hex.toUpperCase() }] : [];
      }),
      ...p.palette.slice(ROLE_ORDER.length).map((swatch, i) => ({
        label: `Spare color ${i + 1}`,
        value: swatch.hex.toUpperCase(),
      })),
      ...(css.length <= MAX_LINE_VALUE ? [{ label: 'Code for your website', value: css }] : []),
    ],
    note: 'The codes are what a printer, a sign writer or whoever built your site will ask for. Keep this somewhere you will find it — using the same five everywhere is most of what makes a small business look put together.',
  });

  return (
    <div className="flex flex-col gap-10">
      <PaletteEditor
        palette={p}
        roles={roles}
        ink={ink}
        scheme={scheme}
        vision={vision}
        onScheme={setScheme}
        onVision={setVision}
        onInk={(role, hex) => setInk((prev) => ({ ...prev, [role]: hex }))}
        onResetInk={resetInk}
      />

      <Preview roles={roles} vision={vision} />

      <div className="grid items-start gap-6 xl:grid-cols-2">
        <Pairs palette={p.palette} vision={vision} />
        <ExportPanel palette={p.palette} roles={roles} ink={ink} />
      </div>
    </div>
  );
}
