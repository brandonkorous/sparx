'use client';

import * as React from 'react';
import { ColorPicker } from '@sparx/ui';
import { Input, NativeSelect, Range, Button } from '@wizeworks/silicaui-react';
import { Shuffle, Lock, LockOpen } from 'lucide-react';
import { Workbench, ControlsPane, OutputPane, Panel, Field, CopyButton, useCopy } from './ui-kit';
import { serializeBrandPalette } from '@sparx/site-themes/brand-palette';
import {
  buildPalette,
  readableTextOn,
  HARMONY_KINDS,
  type HarmonyKind,
  type PaletteColor,
} from './lib/color';
import { usePalette } from './use-palette';
import { PalettePreview } from './palette-preview';

export function PaletteTool() {
  const p = usePalette();
  const { shuffle } = p;
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Spacebar shuffles when the tool is engaged (hovered or focused within) and
  // you're not typing in a field or focused on one of its buttons.
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.code !== 'Space') return;
      const el = containerRef.current;
      if (!el) return;
      const a = document.activeElement as HTMLElement | null;
      if (a && (/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) || a.isContentEditable)) return;
      if (a?.tagName === 'BUTTON' && el.contains(a)) return;
      if (!(el.matches(':hover') || el.contains(a))) return;
      e.preventDefault();
      shuffle();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [shuffle]);

  const active = p.colors[p.selected]!;
  const name = (p.prefix.trim() || 'brand').replace(/[^a-z0-9-]/gi, '').toLowerCase();
  const { css, tailwind } = buildExports(name, p.colors);
  const sparx = buildSparxExport(name, p.colors);

  return (
    <div ref={containerRef}>
      <Workbench>
        <ControlsPane>
          <Panel title="Base color">
            <Field label="Primary color" hint="Anchored as step 500. Unlocked accents follow it.">
              <ColorPicker value={p.primaryHex} onChange={p.setPrimary} ariaLabel="Primary color" />
            </Field>
            <Field
              label="Name"
              htmlFor="pal-name"
              hint="Used in the CSS variable and Tailwind key."
            >
              <Input id="pal-name" value={p.prefix} onChange={(e) => p.setPrefix(e.target.value)} />
            </Field>
          </Panel>

          <Panel title="Color harmony">
            <Field
              label="Scheme"
              htmlFor="pal-harmony"
              hint="How accents relate to your primary on the color wheel."
            >
              <NativeSelect
                id="pal-harmony"
                value={p.harmony}
                onChange={(e) => p.setHarmony(e.target.value as HarmonyKind)}
              >
                {HARMONY_KINDS.map((h) => (
                  <option key={h.value} value={h.value}>
                    {h.label}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field
              label="Accent colors"
              adornment={String(p.accentCount)}
              hint="One to four colors generated alongside your primary."
            >
              <Range
                value={[p.accentCount]}
                onValueChange={(vals) => p.setAccentCount((vals as number[])[0] ?? 1)}
                min={1}
                max={4}
                step={1}
              />
            </Field>
          </Panel>

          <Panel title="Export">
            <ExportBlock
              title="sparx — paste into Builder"
              code={sparx}
              copyLabel="Copy for sparx"
              toast="sparx palette copied"
              hint="Paste this into your site’s Builder → Brand → Import palette to apply these colors to your brand."
            />
            <ExportBlock
              title="CSS variables"
              code={css}
              copyLabel="Copy CSS"
              toast="CSS variables copied"
            />
            <ExportBlock
              title="Tailwind config"
              code={tailwind}
              copyLabel="Copy Tailwind"
              toast="Tailwind config copied"
            />
          </Panel>
        </ControlsPane>

        <OutputPane>
          <Panel
            title="Palette"
            action={
              <span style={metaStyle}>
                {p.colors.length} {p.colors.length === 1 ? 'color' : 'colors'}
              </span>
            }
          >
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <Button type="button" color="module" variant="solid" size="sm" onClick={shuffle}>
                <Shuffle className="h-4 w-4" /> Shuffle
              </Button>
              <span style={hintStyle}>
                or press <kbd style={kbdStyle}>Space</kbd> — lock the colors you want to keep
              </span>
            </div>
            <PaletteSwatches
              colors={p.colors}
              locked={p.locked}
              selected={p.selected}
              onSelect={p.setSelected}
              onToggleLock={p.toggleLock}
            />
            <p style={hintStyle}>
              Click a bar to preview its full scale below; lock it to keep it through shuffles.
            </p>
          </Panel>

          <Panel title="Live preview">
            <PalettePreview colors={p.colors} />
          </Panel>

          <Panel
            title={`Scale · ${active.role}`}
            action={
              <CopyButton value={active.hex} label="Copy hex" toastLabel={`${active.hex} copied`} />
            }
          >
            <ScaleSwatches hex={active.hex} />
            <p style={hintStyle}>
              Click any step to copy its hex. 50 is the lightest tint, 950 the darkest shade.
            </p>
          </Panel>
        </OutputPane>
      </Workbench>
    </div>
  );
}

const hintStyle: React.CSSProperties = {
  fontFamily: 'var(--font-sans)',
  fontSize: '13px',
  color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
  margin: 0,
};

const metaStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: '12px',
  color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
};

const kbdStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: '11px',
  padding: '2px 6px',
  borderRadius: '4px',
  border: '1px solid var(--color-base-300)',
  backgroundColor: 'var(--color-base-100)',
  color: 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
};

const SWATCH_ROLE: React.CSSProperties = {
  fontFamily: 'var(--font-sans)',
  fontSize: 'clamp(9px, 2vw, 10.5px)',
  fontWeight: 600,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  opacity: 0.8,
  maxWidth: '100%',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const SWATCH_HEX: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 'clamp(11px, 2.3vw, 13px)',
  fontWeight: 600,
  letterSpacing: '0.02em',
  maxWidth: '100%',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

function PaletteSwatches({
  colors,
  locked,
  selected,
  onSelect,
  onToggleLock,
}: {
  colors: PaletteColor[];
  locked: boolean[];
  selected: number;
  onSelect: (i: number) => void;
  onToggleLock: (i: number) => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        height: 'clamp(220px, 34vw, 320px)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        border: '1px solid var(--color-base-300)',
      }}
    >
      {colors.map((c, i) => {
        const text = readableTextOn(c.hex);
        const isActive = i === selected;
        const isLocked = locked[i] ?? false;
        return (
          <div key={c.role} style={{ position: 'relative', flex: '1 1 0', minWidth: 0 }}>
            <button
              type="button"
              aria-pressed={isActive}
              onClick={() => onSelect(i)}
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: '3px',
                padding: '14px 8px',
                overflow: 'hidden',
                backgroundColor: c.hex,
                color: text,
                border: 'none',
                cursor: 'pointer',
                boxShadow: isActive ? `inset 0 0 0 3px ${text}` : 'none',
              }}
            >
              <span style={SWATCH_ROLE}>{c.role}</span>
              <span style={SWATCH_HEX}>{c.hex}</span>
            </button>
            <button
              type="button"
              aria-pressed={isLocked}
              aria-label={`${isLocked ? 'Unlock' : 'Lock'} ${c.role}`}
              title={isLocked ? 'Locked — kept on shuffle' : 'Unlocked — changes on shuffle'}
              onClick={() => onToggleLock(i)}
              style={{
                position: 'absolute',
                top: '10px',
                left: '50%',
                transform: 'translateX(-50%)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '28px',
                height: '28px',
                borderRadius: '9999px',
                border: 'none',
                cursor: 'pointer',
                backgroundColor: isLocked
                  ? text
                  : text === '#000000'
                    ? 'rgba(0,0,0,0.14)'
                    : 'rgba(255,255,255,0.24)',
                color: isLocked ? c.hex : text,
              }}
            >
              {isLocked ? <Lock size={14} /> : <LockOpen size={14} />}
            </button>
          </div>
        );
      })}
    </div>
  );
}

function ScaleSwatches({ hex }: { hex: string }) {
  const { copy } = useCopy();
  const scale = buildPalette(hex);
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        border: '1px solid var(--color-base-300)',
      }}
    >
      {scale.map((swatch) => {
        const text = readableTextOn(swatch.hex);
        return (
          <button
            key={swatch.step}
            type="button"
            onClick={() => copy(swatch.hex, `${swatch.hex} copied`)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px',
              backgroundColor: swatch.hex,
              color: text,
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'var(--font-mono)',
              fontSize: '13px',
            }}
          >
            <span style={{ fontWeight: 600 }}>{swatch.step}</span>
            <span>{swatch.hex}</span>
          </button>
        );
      })}
    </div>
  );
}

function ExportBlock({
  title,
  code,
  copyLabel,
  toast,
  hint,
}: {
  title: string;
  code: string;
  copyLabel: string;
  toast: string;
  hint?: string;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <span
        style={{
          fontFamily: 'var(--font-sans)',
          fontSize: '13px',
          fontWeight: 500,
          color: 'var(--color-base-content)',
        }}
      >
        {title}
      </span>
      <pre className="tool-code" style={{ maxHeight: '220px' }}>
        {code}
      </pre>
      <div>
        <CopyButton value={code} label={copyLabel} toastLabel={toast} />
      </div>
      {hint ? <p style={hintStyle}>{hint}</p> : null}
    </div>
  );
}

/**
 * The sparx interchange export — the same palette as a `sparx.brand-palette` JSON
 * that the Builder's brand importer can paste-apply. Content (foreground) colors
 * are the WCAG-readable pick for each fill. Shares one format module with the
 * dashboard, so the two never drift.
 */
function buildSparxExport(name: string, colors: PaletteColor[]): string {
  const toColor = (c: PaletteColor) => ({ fill: c.hex, content: readableTextOn(c.hex) });
  return serializeBrandPalette({
    name,
    source: 'https://sparx.works/tools/color-palette',
    primary: toColor(colors[0]!),
    accents: colors.slice(1).map(toColor),
  });
}

/**
 * Build the export strings. Every color — primary and each accent — ships as a
 * full 50–950 ramp so the whole palette is dev-ready, not just the primary.
 * The primary uses the bare name; accents are suffixed `-accent-1`, `-accent-2`…
 */
function buildExports(name: string, colors: PaletteColor[]): { css: string; tailwind: string } {
  const cssLines: string[] = [':root {'];
  const twLines: string[] = ['colors: {'];

  colors.forEach((c, i) => {
    const key = i === 0 ? name : `${name}-accent-${i}`;
    const ramp = buildPalette(c.hex);

    if (i > 0) cssLines.push('');
    cssLines.push(`  /* ${c.role} */`);
    ramp.forEach((s) => cssLines.push(`  --${key}-${s.step}: ${s.hex.toLowerCase()};`));

    twLines.push(i === 0 ? `  ${name}: {` : `  '${name}-accent-${i}': {`);
    ramp.forEach((s) => twLines.push(`    ${s.step}: '${s.hex.toLowerCase()}',`));
    twLines.push('  },');
  });

  cssLines.push('}');
  twLines.push('}');
  return { css: cssLines.join('\n'), tailwind: twLines.join('\n') };
}
