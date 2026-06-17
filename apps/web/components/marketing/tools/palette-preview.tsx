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

const LABEL: React.CSSProperties = {
  fontFamily: 'var(--font-sans)',
  fontSize: '11px',
  fontWeight: 600,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  color: '#71717A',
};

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
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '18px',
        padding: '20px',
        borderRadius: 'var(--radius-lg)',
        backgroundColor: '#FFFFFF',
        border: '1px solid #E4E4E7',
        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
      }}
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
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: '12px',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <span style={LABEL}>Dashboard</span>
        <span
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: '15px',
            fontWeight: 600,
            color: '#18181B',
          }}
        >
          Your palette in context
        </span>
      </div>
      <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={LABEL}>Page score</span>
          <span
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: '26px',
              fontWeight: 700,
              color: '#18181B',
              lineHeight: 1,
            }}
          >
            91<span style={{ fontSize: '14px', fontWeight: 500, color: '#A1A1AA' }}>/100</span>
          </span>
        </div>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            padding: '4px 10px',
            borderRadius: '9999px',
            backgroundColor: theme.softBg,
            color: theme.softText,
            fontFamily: 'var(--font-sans)',
            fontSize: '12px',
            fontWeight: 600,
          }}
        >
          <BadgeCheck size={14} /> All good
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '5px', height: '72px' }}>
        {CHART_HEIGHTS.map((h, i) => {
          const c = colors[i % colors.length] ?? colors[0]!;
          return (
            <div
              key={`${h}-${i}`}
              style={{
                flex: 1,
                height: `${h}%`,
                backgroundColor: c.hex,
                borderRadius: '3px 3px 0 0',
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

function PreviewBadges({ colors }: { colors: PaletteColor[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <span style={LABEL}>Badges</span>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        {colors.map((c) => (
          <span
            key={c.role}
            style={{
              padding: '4px 11px',
              borderRadius: '9999px',
              backgroundColor: c.hex,
              color: readableTextOn(c.hex),
              fontFamily: 'var(--font-sans)',
              fontSize: '12px',
              fontWeight: 600,
            }}
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
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '12px 14px',
        borderRadius: 'var(--radius-md)',
        backgroundColor: theme.tintBg,
        borderLeft: `3px solid ${theme.primary}`,
      }}
    >
      <TrendingUp size={18} style={{ color: theme.primary, flexShrink: 0 }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
        <span
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: '13.5px',
            fontWeight: 600,
            color: theme.softText,
          }}
        >
          Verification complete
        </span>
        <span style={{ fontFamily: 'var(--font-sans)', fontSize: '12.5px', color: '#71717A' }}>
          Your brand colors are ready to ship.
        </span>
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <span style={LABEL}>Progress</span>
      {PROGRESS.map((row, i) => {
        const c = colors[i % colors.length]?.hex ?? primary;
        return (
          <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: '12px',
                color: '#52525B',
                width: '48px',
                flexShrink: 0,
              }}
            >
              {row.label}
            </span>
            <div
              style={{
                flex: 1,
                height: '8px',
                borderRadius: '9999px',
                backgroundColor: '#F1F1F3',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: row.width,
                  height: '100%',
                  backgroundColor: c,
                  borderRadius: '9999px',
                }}
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <span style={LABEL}>Buttons</span>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' }}>
        {colors.map((c) => (
          <Btn key={c.role} bg={c.hex} fg={readableTextOn(c.hex)}>
            {c.role}
          </Btn>
        ))}
        <Btn bg={theme.softBg} fg={theme.softText}>
          Soft
        </Btn>
        <span
          style={{
            padding: '7px 13px',
            borderRadius: 'var(--radius-md)',
            border: `1px solid ${theme.primary}`,
            color: theme.softText,
            backgroundColor: 'transparent',
            fontFamily: 'var(--font-sans)',
            fontSize: '13px',
            fontWeight: 500,
          }}
        >
          Outline
        </span>
        <span
          aria-hidden
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            width: '38px',
            height: '22px',
            padding: '2px',
            borderRadius: '9999px',
            backgroundColor: theme.primary,
            justifyContent: 'flex-end',
          }}
        >
          <span
            style={{
              width: '18px',
              height: '18px',
              borderRadius: '9999px',
              backgroundColor: '#FFFFFF',
            }}
          />
        </span>
      </div>
    </div>
  );
}

function Btn({ bg, fg, children }: { bg: string; fg: string; children: React.ReactNode }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '7px 13px',
        borderRadius: 'var(--radius-md)',
        backgroundColor: bg,
        color: fg,
        fontFamily: 'var(--font-sans)',
        fontSize: '13px',
        fontWeight: 500,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
}
