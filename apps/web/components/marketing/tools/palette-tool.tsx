'use client';

import * as React from 'react';
import {
  Button,
  Input,
  Kbd,
  Link,
  NativeSelect,
  ToggleGroup,
  ToggleGroupItem,
  Tooltip,
  TooltipProvider,
} from '@wizeworks/silicaui-react';
import { Shuffle, Lock, LockOpen } from 'lucide-react';
import {
  Workbench,
  ControlsPane,
  OutputPane,
  Panel,
  Field,
  CopyButton,
  useCopy,
  NumberRange,
  CodeBlock,
  HexColorField,
} from './ui-kit';
import { buildExports, buildSilicaTheme, buildSparxExport } from './palette-exports';
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
  const silica = buildSilicaTheme(name, p.colors);
  const sparx = buildSparxExport(name, p.colors);

  return (
    <div ref={containerRef}>
      <Workbench>
        <ControlsPane>
          <Panel title="Base color">
            <Field
              label="Primary color"
              htmlFor="pal-primary"
              hint="Anchored as step 500. Unlocked accents follow it."
            >
              <HexColorField
                id="pal-primary"
                label="Primary color"
                value={p.primaryHex}
                onChange={p.setPrimary}
              />
            </Field>
            <Field
              label="Name"
              htmlFor="pal-name"
              hint="Names your theme and each color in the files below."
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
              <NumberRange
                value={p.accentCount}
                onValueChange={p.setAccentCount}
                min={1}
                max={4}
                step={1}
              />
            </Field>
          </Panel>

          <Panel title="Take your colors with you">
            <ExportBlock
              title="Ready-made theme for silicaui"
              code={silica}
              copyLabel="Copy theme"
              toast="silicaui theme copied"
              hint={
                <>
                  silicaui is a design system — it turns one set of colors into every button, badge
                  and card on a site, so you set your colors once instead of hunting them down
                  screen by screen. Paste this into the stylesheet that controls how your site looks
                  and your palette takes over, in both light and dark mode. sparx itself is built on
                  silicaui, so this same theme works on your sparx site. More at{' '}
                  <Link href="https://silicaui.com" color="module">
                    silicaui.com
                  </Link>
                  .
                </>
              }
            />
            <ExportBlock
              title="Tailwind config"
              code={tailwind}
              copyLabel="Copy Tailwind"
              toast="Tailwind config copied"
              hint="For a site built with Tailwind CSS. Every color comes as a full range of light-to-dark shades, ready to drop into your config file."
            />
            <ExportBlock
              title="Plain CSS variables"
              code={css}
              copyLabel="Copy CSS"
              toast="CSS variables copied"
              hint="The same shades as plain CSS, for a site that doesn’t use either of the above."
            />
            <ExportBlock
              title="Already using sparx?"
              code={sparx}
              copyLabel="Copy for sparx"
              toast="sparx palette copied"
              hint="Your Builder can read this directly. Copy it, then open your site and go to Builder → Brand → Import palette to recolor your brand."
            />
          </Panel>
        </ControlsPane>

        <OutputPane>
          <Panel
            title="Palette"
            action={
              <span className="text-caption text-ink-muted font-mono">
                {p.colors.length} {p.colors.length === 1 ? 'color' : 'colors'}
              </span>
            }
          >
            <div className="flex flex-wrap items-center gap-2.5">
              <Button type="button" color="module" variant="solid" size="sm" onClick={shuffle}>
                <Shuffle className="h-4 w-4" /> Shuffle
              </Button>
              <span className="text-body-sm text-ink-muted">
                or press <Kbd size="sm">Space</Kbd> — lock the colors you want to keep
              </span>
            </div>
            <PaletteSwatches
              colors={p.colors}
              locked={p.locked}
              selected={p.selected}
              onSelect={p.setSelected}
              onToggleLock={p.toggleLock}
            />
            <p className="text-body-sm text-ink-muted m-0">
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
            <p className="text-body-sm text-ink-muted m-0">
              Click any step to copy its hex. 50 is the lightest tint, 950 the darkest shade.
            </p>
          </Panel>
        </OutputPane>
      </Workbench>
    </div>
  );
}

/**
 * The palette strip — a single-select segmented control whose "segments" are
 * the generated colors. Selection, roving focus, and focus-visible all come
 * from silica's `ToggleGroup`; the only inline values are the swatch fill and
 * the WCAG-readable ink on it, which are the user's colors by definition. The
 * selected ring is `inset-ring-current`, so it inherits that same readable ink.
 */
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
    <TooltipProvider>
      <ToggleGroup
        value={[String(selected)]}
        onValueChange={(next: unknown[]) => {
          // Base UI types the group value as `any[]`; ours is always the index
          // as a string. An empty array means "deselected" — the strip always
          // has one active bar, so that is ignored rather than cleared.
          const first = next[0];
          if (typeof first === 'string') onSelect(Number(first));
        }}
        className="flex h-56 w-full gap-0 overflow-hidden rounded-lg p-0 sm:h-72 lg:h-80"
      >
        {colors.map((c, i) => {
          const text = readableTextOn(c.hex);
          return (
            <div key={c.role} className="relative flex min-w-0 flex-1">
              <ToggleGroupItem
                value={String(i)}
                className="flex h-auto w-full min-w-0 flex-col items-center justify-end gap-0.5 rounded-none px-2 py-3.5 inset-ring-current data-[pressed]:shadow-none data-[pressed]:inset-ring-4"
                style={{ backgroundColor: c.hex, color: text }}
              >
                <span className="text-micro w-full truncate text-center font-semibold tracking-wide uppercase">
                  {c.role}
                </span>
                <span className="text-caption w-full truncate text-center font-mono font-semibold">
                  {c.hex}
                </span>
              </ToggleGroupItem>
              <LockToggle
                role={c.role}
                hex={c.hex}
                ink={text}
                locked={locked[i] ?? false}
                onToggle={() => onToggleLock(i)}
              />
            </div>
          );
        })}
      </ToggleGroup>
    </TooltipProvider>
  );
}

/**
 * Keep-through-shuffle toggle pinned to a swatch. Locked reads as a filled
 * inverse pill, unlocked as a ghost — both are silica `Button` variants driven
 * by the button's own `--btn-*` tokens, pointed at the swatch's color pair so
 * the control stays legible on any fill the generator produces.
 */
function LockToggle({
  role,
  hex,
  ink,
  locked,
  onToggle,
}: {
  role: string;
  hex: string;
  ink: string;
  locked: boolean;
  onToggle: () => void;
}) {
  const tokens = locked
    ? ({ '--btn-bg': ink, '--btn-fg': hex } as React.CSSProperties)
    : ({ '--btn-accent': ink } as React.CSSProperties);
  return (
    <Tooltip content={locked ? 'Locked — kept on shuffle' : 'Unlocked — changes on shuffle'}>
      <Button
        type="button"
        size="xs"
        shape="circle"
        variant={locked ? 'solid' : 'ghost'}
        aria-pressed={locked}
        aria-label={`${locked ? 'Unlock' : 'Lock'} ${role}`}
        onClick={onToggle}
        className="absolute top-2.5 left-1/2 -translate-x-1/2"
        style={tokens}
      >
        {locked ? <Lock size={14} /> : <LockOpen size={14} />}
      </Button>
    </Tooltip>
  );
}

/**
 * The 50–950 ramp for the selected color. Each step is a silica `Button` (so
 * hover, focus-visible, and press feedback are the design system's) laid out as
 * a full-bleed bar; only the fill and its readable ink are inline.
 */
function ScaleSwatches({ hex }: { hex: string }) {
  const { copy } = useCopy();
  const scale = buildPalette(hex);
  return (
    <div className="border-base-300 flex flex-col overflow-hidden rounded-lg border">
      {scale.map((swatch) => (
        <Button
          key={swatch.step}
          type="button"
          variant="ghost"
          onClick={() => copy(swatch.hex, `${swatch.hex} copied`)}
          className="text-caption flex h-auto w-full items-center justify-between rounded-none px-4 py-3 font-mono font-normal"
          style={{ backgroundColor: swatch.hex, color: readableTextOn(swatch.hex) }}
        >
          <span className="font-semibold">{swatch.step}</span>
          <span>{swatch.hex}</span>
        </Button>
      ))}
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
  hint?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-body-sm text-base-content font-medium">{title}</span>
      <CodeBlock height="short">{code}</CodeBlock>
      <div>
        <CopyButton value={code} label={copyLabel} toastLabel={toast} />
      </div>
      {hint ? <p className="text-body-sm text-ink-muted m-0">{hint}</p> : null}
    </div>
  );
}
