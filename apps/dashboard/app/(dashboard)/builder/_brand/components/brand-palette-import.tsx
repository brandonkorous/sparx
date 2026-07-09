'use client';

// Paste-to-apply for a sparx brand palette — the loop from the public color tool
// (sparx.works/tools/color-palette → "Copy for sparx" → here). Lives as a button
// in the Brand theme toolbar; clicking it opens a modal where you paste the
// exported JSON, map its primary + accents onto the three brand roles (auto-mapped
// but adjustable), and apply. We parse with the SHARED format module so the two
// can't drift. Applying just drives the same brand-colour setters the swatches
// use, so the existing debounced autosave persists it to the right scope (base
// brand vs per-site override). Overwriting brand colours is gated behind a confirm
// (the destructive-action rule); the AlertDialog stacks cleanly over the modal.

import * as React from 'react';
import { ClipboardPaste } from 'lucide-react';
import {
  Alert,
  Button,
  Modal,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
  ModalTrigger,
  NativeSelect,
  Textarea,
  toast,
  useConfirm,
} from '@sparx/ui';
import {
  parseBrandPalette,
  type BrandPaletteColor,
  type SparxBrandPalette,
} from '@sparx/site-themes';

type RoleKey = 'primary' | 'secondary' | 'accent';
const ROLES: { key: RoleKey; label: string }[] = [
  { key: 'primary', label: 'Primary' },
  { key: 'secondary', label: 'Secondary' },
  { key: 'accent', label: 'Accent' },
];

const KEEP = '__keep__';

// The palette's colours flattened into an addressable list for the dropdowns.
interface SourceColor extends BrandPaletteColor {
  id: string;
  label: string;
}
function sourcesOf(palette: SparxBrandPalette): SourceColor[] {
  return [
    { id: 'primary', label: 'Primary', ...palette.primary },
    ...palette.accents.map((c, i) => ({ id: `accent-${i}`, label: `Accent ${i + 1}`, ...c })),
  ];
}

// Auto-map (the tenant picked "auto + adjustable"): Primary←primary,
// Accent←first accent, Secondary←second accent. Missing slots default to "keep".
function autoMap(sources: SourceColor[]): Record<RoleKey, string> {
  return {
    primary: sources[0]?.id ?? KEEP,
    accent: sources[1]?.id ?? KEEP,
    secondary: sources[2]?.id ?? KEEP,
  };
}

export interface AppliedRoles {
  primary: BrandPaletteColor | null;
  secondary: BrandPaletteColor | null;
  accent: BrandPaletteColor | null;
}

export function BrandPaletteImport({ onApply }: { onApply: (roles: AppliedRoles) => void }) {
  const confirm = useConfirm();
  const [open, setOpen] = React.useState(false);
  const [text, setText] = React.useState('');
  const [map, setMap] = React.useState<Record<RoleKey, string>>({
    primary: KEEP,
    secondary: KEEP,
    accent: KEEP,
  });

  const parsed = React.useMemo(() => (text.trim() ? parseBrandPalette(text) : null), [text]);
  const palette = parsed?.ok ? parsed.palette : null;
  const sources = React.useMemo(() => (palette ? sourcesOf(palette) : []), [palette]);

  // Seed the auto-map each time a newly-valid palette parses.
  React.useEffect(() => {
    if (palette) setMap(autoMap(sourcesOf(palette)));
  }, [palette]);

  const apply = async () => {
    if (!palette) return;
    const resolve = (id: string): BrandPaletteColor | null =>
      id === KEEP ? null : (sources.find((s) => s.id === id) ?? null);
    const roles: AppliedRoles = {
      primary: resolve(map.primary),
      secondary: resolve(map.secondary),
      accent: resolve(map.accent),
    };
    const changing = ROLES.filter((r) => roles[r.key]).map((r) => r.label);
    if (changing.length === 0) {
      toast.error('Map at least one color to a brand role first.');
      return;
    }
    const ok = await confirm({
      title: 'Apply pasted palette?',
      description: `This replaces your ${changing.join(', ')} brand color${
        changing.length > 1 ? 's' : ''
      } with the pasted palette. Edit any swatch afterward to tweak it.`,
      confirmLabel: 'Apply colors',
      tone: 'module',
    });
    if (!ok) return;
    onApply(roles);
    toast.success('Brand colors updated from palette.');
    setOpen(false);
    setText('');
  };

  return (
    <Modal
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setText('');
      }}
    >
      <ModalTrigger>
        <button
          type="button"
          className="bx-newtpl"
          aria-label="Import a sparx palette"
          title="Import palette"
        >
          <ClipboardPaste aria-hidden />
        </button>
      </ModalTrigger>
      <ModalContent className="max-w-md">
        <ModalHeader>
          <ModalTitle>Import brand palette</ModalTitle>
          <ModalDescription>
            Paste a palette from the color palette tool (“Copy for sparx”) to recolor your brand.
          </ModalDescription>
        </ModalHeader>

        <div className="flex flex-col gap-3">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            spellCheck={false}
            aria-label="Sparx palette JSON"
            placeholder='{ "sparx": "sparx.brand-palette", … }'
            className="font-mono text-xs"
          />

          {parsed && !parsed.ok ? (
            <Alert color="danger" variant="soft" size="sm">
              {parsed.error}
            </Alert>
          ) : null}

          {palette ? <PaletteMapper sources={sources} map={map} onChange={setMap} /> : null}
        </div>

        <ModalFooter>
          <Button
            type="button"
            variant="ghost"
            color="neutral"
            size="sm"
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="solid"
            color="module"
            size="sm"
            disabled={!palette}
            onClick={() => void apply()}
          >
            Apply to brand
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

function PaletteMapper({
  sources,
  map,
  onChange,
}: {
  sources: SourceColor[];
  map: Record<RoleKey, string>;
  onChange: React.Dispatch<React.SetStateAction<Record<RoleKey, string>>>;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap gap-1.5">
        {sources.map((s) => (
          <span
            key={s.id}
            title={`${s.label} · ${s.fill}`}
            className="border-base-300 h-7 w-7 rounded-md border"
            style={{ backgroundColor: s.fill }}
          />
        ))}
      </div>
      <div className="flex flex-col gap-2">
        {ROLES.map((role) => {
          const sel = map[role.key];
          const chosen = sources.find((s) => s.id === sel) ?? null;
          return (
            <div key={role.key} className="flex items-center gap-2">
              <span className="text-base-content/70 w-20 shrink-0 text-xs">{role.label}</span>
              <NativeSelect
                aria-label={`${role.label} source color`}
                value={sel}
                onChange={(e) => onChange((m) => ({ ...m, [role.key]: e.target.value }))}
                className="min-w-0 flex-1"
              >
                <option value={KEEP}>Keep current</option>
                {sources.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label} — {s.fill}
                  </option>
                ))}
              </NativeSelect>
              <span
                aria-hidden
                className="border-base-300 h-7 w-7 shrink-0 rounded-md border"
                style={{ backgroundColor: chosen?.fill ?? 'transparent' }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
