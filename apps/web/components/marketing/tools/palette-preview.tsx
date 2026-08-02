'use client';

import * as React from 'react';
import { BadgeCheck, TrendingUp } from 'lucide-react';
import { buildPalette, readableTextOn, type PaletteColor } from './lib/color';

/**
 * "Your palette in context" — a miniature, light-surfaced dashboard that applies
 * the generated palette to real UI (buttons, badges, an alert, a chart, progress
 * bars). It answers the question a flat swatch strip can't: how does this set of
 * colours actually feel on an interface? Colours are shown on a neutral canvas so
 * they read true regardless of the visitor's light/dark site theme, and every
 * coloured surface uses `readableTextOn` so its label always stays legible.
 *
 * NOTE ON COLOR: every `backgroundColor`/`color` left inline here is a RUNTIME
 * value — a hex the visitor picked or one `buildPalette`/`readableTextOn`
 * computed from it. That is data, not styling, so it cannot become a utility.
 * The surrounding chrome (canvas, chart track, neutral ink) is deliberately
 * FIXED — the whole point is that the swatches read true no matter which theme
 * the visitor is browsing in. That is expressed as `data-theme="light"` on the
 * root, which pins this subtree to the sparx light palette so `bg-base-100` /
 * `text-base-content` cannot flip underneath the swatches. It used to be spelled
 * with Tailwind's own palette (`bg-white`, `text-zinc-*`) — a third color
 * vocabulary alongside silica's. Layout, spacing, radius and type are utilities.
 */
interface PreviewTheme {
  primary: string;
  onPrimary: string;
  softBg: string;
  softText: string;
  tintBg: string;
}

function stepHex(hex: string, step: number): string {
  return buildPalette(hex).find((s) => s.step === step)?.hex ?? hex;
}

/** Group label for a row of swatches — a functional legend, not an eyebrow. */
const LABEL = 'text-sm font-semibold';

export function PalettePreview({ colors }: { colors: PaletteColor[] }) {
  const primary = colors[0] ?? { role: 'Primary', hex: '#6366F1' };
  const theme: PreviewTheme = {
    primary: primary.hex,
    onPrimary: readableTextOn(primary.hex),
    softBg: stepHex(primary.hex, 100),
    softText: stepHex(primary.hex, 700),
    tintBg: stepHex(primary.hex, 50),
  };

  return (
    <div
      data-theme="light"
      className="border-base-300 text-base-content bg-base-100 flex flex-col gap-[18px] rounded-lg border p-5"
    >
      <PreviewHeader theme={theme} />
      <PreviewStat theme={theme} colors={colors} />
      <PreviewBadges colors={colors} />
      <PreviewAlert theme={theme} />
      <PreviewProgress colors={colors} primary={primary.hex} />
      <PreviewButtons theme={theme} colors={colors} />
    </div>
  );
}

function PreviewHeader({ theme }: { theme: PreviewTheme }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-base-content text-[15px] font-semibold">Your palette in context</span>
      <div className="flex shrink-0 gap-2">
        <Btn bg={theme.softBg} fg={theme.softText}>
          Charts
        </Btn>
        <Btn bg={theme.primary} fg={theme.onPrimary}>
          Details
        </Btn>
      </div>
    </div>
  );
}

const CHART_HEIGHTS = [40, 58, 32, 72, 50, 86, 64, 94, 56, 78];

function PreviewStat({ theme, colors }: { theme: PreviewTheme; colors: PaletteColor[] }) {
  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <span className={LABEL}>Page score</span>
          <span className="text-base-content text-[26px] leading-none font-bold">
            91<span className="text-base-content text-sm font-medium">/100</span>
          </span>
        </div>
        <span
          className="inline-flex items-center gap-[5px] rounded-full px-2.5 py-1 text-xs font-semibold"
          style={{ backgroundColor: theme.softBg, color: theme.softText }}
        >
          <BadgeCheck size={14} /> All good
        </span>
      </div>
      <div className="flex h-[72px] items-end gap-[5px]">
        {CHART_HEIGHTS.map((h, i) => {
          const c = colors[i % colors.length] ?? colors[0]!;
          return (
            <div
              key={`${h}-${i}`}
              className="flex-1 rounded-t-[3px]"
              style={{ height: `${h}%`, backgroundColor: c.hex }}
            />
          );
        })}
      </div>
    </div>
  );
}

function PreviewBadges({ colors }: { colors: PaletteColor[] }) {
  return (
    <div className="flex flex-col gap-2">
      <span className={LABEL}>Badges</span>
      <div className="flex flex-wrap gap-2">
        {colors.map((c) => (
          <span
            key={c.role}
            className="rounded-full px-[11px] py-1 text-xs font-semibold"
            style={{ backgroundColor: c.hex, color: readableTextOn(c.hex) }}
          >
            {c.role}
          </span>
        ))}
      </div>
    </div>
  );
}

function PreviewAlert({ theme }: { theme: PreviewTheme }) {
  return (
    <div
      className="flex items-center gap-3 rounded-md border-l-[3px] px-3.5 py-3"
      style={{ backgroundColor: theme.tintBg, borderLeftColor: theme.primary }}
    >
      <TrendingUp size={18} className="shrink-0" style={{ color: theme.primary }} />
      <div className="flex flex-col gap-px">
        <span className="text-sm font-semibold" style={{ color: theme.softText }}>
          Verification complete
        </span>
        <span className="text-base-content text-xs">Your brand colors are ready to ship.</span>
      </div>
    </div>
  );
}

const PROGRESS = [
  { label: 'Setup', width: '78%' },
  { label: 'Launch', width: '46%' },
];

function PreviewProgress({ colors, primary }: { colors: PaletteColor[]; primary: string }) {
  return (
    <div className="flex flex-col gap-2.5">
      <span className={LABEL}>Progress</span>
      {PROGRESS.map((row, i) => {
        const c = colors[i % colors.length]?.hex ?? primary;
        return (
          <div key={row.label} className="flex items-center gap-2.5">
            <span className="text-base-content w-12 shrink-0 text-xs">{row.label}</span>
            <div className="bg-base-200 h-2 flex-1 overflow-hidden rounded-full">
              <div
                className="h-full rounded-full"
                style={{ width: row.width, backgroundColor: c }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PreviewButtons({ theme, colors }: { theme: PreviewTheme; colors: PaletteColor[] }) {
  return (
    <div className="flex flex-col gap-2">
      <span className={LABEL}>Buttons</span>
      <div className="flex flex-wrap items-center gap-2">
        {colors.map((c) => (
          <Btn key={c.role} bg={c.hex} fg={readableTextOn(c.hex)}>
            {c.role}
          </Btn>
        ))}
        <Btn bg={theme.softBg} fg={theme.softText}>
          Soft
        </Btn>
        <span
          className="rounded-md border bg-transparent px-[13px] py-[7px] text-[13px] font-medium"
          style={{ borderColor: theme.primary, color: theme.softText }}
        >
          Outline
        </span>
        <span
          aria-hidden
          className="inline-flex h-[22px] w-[38px] items-center justify-end rounded-full p-0.5"
          style={{ backgroundColor: theme.primary }}
        >
          <span className="bg-base-100 h-[18px] w-[18px] rounded-full" />
        </span>
      </div>
    </div>
  );
}

function Btn({ bg, fg, children }: { bg: string; fg: string; children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center rounded-md px-[13px] py-[7px] text-[13px] font-medium whitespace-nowrap"
      style={{ backgroundColor: bg, color: fg }}
    >
      {children}
    </span>
  );
}
