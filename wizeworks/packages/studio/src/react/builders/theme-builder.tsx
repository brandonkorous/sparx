'use client';

// The theme builder — one pane, one theme document.
//
// A theme is tenant-wide and reusable across sites, so this pane is not editing
// "this site's colors"; it is editing a thing the site WEARS. Every layout and
// page pane open beside it resolves through the same store, so a color change
// here repaints those canvases as it is made — no save, no reload, no socket.
//
// The whole control set is driven by silica's own vocabulary (`SEMANTIC_ROLES`,
// `SURFACE_TOKENS`, `SCALAR_TOKENS`) rather than a hand-written list. That is the
// difference between a theme editor that gains a control when silica gains a
// token and one that quietly stops covering the theme it claims to edit.
//
// LIGHT AND DARK ARE EDITED SEPARATELY, and the switch says which you are on. A
// theme's `dark` map is a delta the author wrote to escape the light value; a
// control that wrote both would silently undo that the first time anyone nudged a
// color.

import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Field,
  FieldDescription,
  FieldLabel,
  Input,
  NativeSelect,
} from '@wizeworks/silicaui-react';
import {
  AA_NORMAL,
  SCALAR_TOKENS,
  SURFACE_TOKENS,
  contrastRatio,
  deriveContent,
  parseColor,
} from '@wizeworks/silicaui-html';
import { buildSilicaThemeCssFromTheme } from '@wizeworks/site-themes';
import type { ThemeDoc } from '../../documents/types';
import { isEditable } from '../../documents/types';
import { useApply, useDoc } from '../context';
import { ThemePreview } from './theme-preview';

type Mode = 'light' | 'dark';

/** One non-color token, as the builder renders it. silica declares
 *  `SCALAR_TOKENS` as a tuple of literals — precise for a lookup, unusable for a
 *  list — so this is the shape they all share. */
interface ScalarToken {
  key: string;
  label: string;
  group: string;
  default: string;
  doc: string;
  options?: readonly { label: string; value: string }[];
}

/** Every color a theme declares, in the order an author thinks about them. */
const COLOR_GROUPS: { label: string; tokens: string[]; hint: string }[] = [
  {
    label: 'Your brand',
    hint: 'The colors people will recognise as yours.',
    tokens: ['--color-primary', '--color-secondary', '--color-accent'],
  },
  {
    label: 'Pages and text',
    hint: 'The paper your site is printed on, and the ink on it.',
    tokens: SURFACE_TOKENS.map((token) => `--color-${token}`),
  },
  {
    label: 'Messages',
    hint: 'Used for confirmations, warnings and problems.',
    tokens: ['--color-info', '--color-success', '--color-warning', '--color-error'],
  },
  {
    label: 'Everything else',
    hint: 'A quiet color for things that are just there.',
    tokens: ['--color-neutral'],
  },
];

const TOKEN_LABELS: Record<string, string> = {
  '--color-primary': 'Main color',
  '--color-secondary': 'Second color',
  '--color-accent': 'Highlight',
  '--color-neutral': 'Neutral',
  '--color-info': 'Information',
  '--color-success': 'Success',
  '--color-warning': 'Warning',
  '--color-error': 'Problem',
  '--color-base-100': 'Page background',
  '--color-base-200': 'Raised background',
  '--color-base-300': 'Sunken background',
  '--color-base-content': 'Text color',
};

const SCALAR_GROUP_LABELS: Record<string, string> = {
  radius: 'Corners',
  form: 'Controls',
  effects: 'Depth and focus',
  motion: 'Movement',
};

export function ThemeBuilder({
  toolbar,
  statusBar,
}: {
  toolbar?: React.ReactNode;
  statusBar?: React.ReactNode;
}) {
  const doc = useDoc<ThemeDoc>();
  const apply = useApply();
  const [mode, setMode] = useState<Mode>('light');
  const editable = isEditable(doc);

  const values = useMemo(
    () => (mode === 'dark' ? { ...doc.theme.tokens, ...(doc.theme.dark ?? {}) } : doc.theme.tokens),
    [doc.theme, mode]
  );

  const setToken = useCallback(
    (token: string, value: string) => {
      apply(`Set ${TOKEN_LABELS[token] ?? token}`, [
        { kind: 'theme.setToken', mode, token, value: value || undefined },
      ]);
    },
    [apply, mode]
  );

  const previewCss = useMemo(
    () => buildSilicaThemeCssFromTheme(doc.theme, { rootSelector: '[data-studio-theme-preview]' }),
    [doc.theme]
  );

  const scalarGroups = useMemo(() => {
    // Normalised out of silica's tuple: each member has its own literal type, so
    // grouping them without this collapses to "no two entries are the same shape".
    const byGroup = new Map<string, ScalarToken[]>();
    for (const token of SCALAR_TOKENS as readonly ScalarToken[]) {
      byGroup.set(token.group, [...(byGroup.get(token.group) ?? []), token]);
    }
    return [...byGroup.entries()];
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-base-300 flex shrink-0 flex-wrap items-center gap-2 border-b px-3 py-2">
        <Button
          size="sm"
          {...(mode === 'light' ? { color: 'primary' as const } : {})}
          onClick={() => setMode('light')}
        >
          Daytime
        </Button>
        <Button
          size="sm"
          {...(mode === 'dark' ? { color: 'primary' as const } : {})}
          onClick={() => setMode('dark')}
        >
          Night-time
        </Button>
        <div className="ml-auto flex items-center gap-2">{toolbar}</div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="min-h-0 flex-1 overflow-auto p-4">
          {!editable ? (
            <Alert color="info" variant="soft" className="mb-4">
              <AlertTitle>This is one of our ready-made looks</AlertTitle>
              <AlertDescription>
                Make a copy to change it — the original stays available to everyone.
              </AlertDescription>
            </Alert>
          ) : null}

          {mode === 'dark' ? (
            <p className="text-base-content bg-base-200 mb-4 rounded p-2 text-sm">
              Anything you leave alone here uses its daytime color.
            </p>
          ) : null}

          <Field className="mb-6 max-w-sm">
            <FieldLabel>Name</FieldLabel>
            <Input
              key={`${doc.id}:name`}
              defaultValue={doc.name}
              disabled={!editable}
              onBlur={(event) => {
                const value = event.currentTarget.value.trim();
                if (!value || value === doc.name) return;
                apply('Rename', [{ kind: 'doc.rename', value }]);
              }}
            />
          </Field>

          {COLOR_GROUPS.map((group) => (
            <section key={group.label} className="mb-6">
              <h3 className="text-base-content text-sm font-medium">{group.label}</h3>
              <p className="text-base-content mb-2 text-sm">{group.hint}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {group.tokens.map((token) => (
                  <ColorField
                    key={token}
                    token={token}
                    value={values[token] ?? ''}
                    ink={values['--color-base-content']}
                    disabled={!editable}
                    onChange={(value) => setToken(token, value)}
                  />
                ))}
              </div>
            </section>
          ))}

          {scalarGroups.map(([group, tokens]) => (
            <section key={group} className="mb-6">
              <h3 className="text-base-content mb-2 text-sm font-medium">
                {SCALAR_GROUP_LABELS[group] ?? group}
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {tokens.map((token) => (
                  <Field key={token.key}>
                    <FieldLabel>{token.label}</FieldLabel>
                    {token.options ? (
                      <NativeSelect
                        key={`${doc.id}:${token.key}`}
                        defaultValue={values[token.key] ?? token.default}
                        disabled={!editable}
                        onChange={(event) => setToken(token.key, event.currentTarget.value)}
                      >
                        {token.options.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </NativeSelect>
                    ) : (
                      <Input
                        key={`${doc.id}:${token.key}`}
                        defaultValue={values[token.key] ?? token.default}
                        disabled={!editable}
                        onBlur={(event) => setToken(token.key, event.currentTarget.value.trim())}
                      />
                    )}
                    <FieldDescription>{token.doc}</FieldDescription>
                  </Field>
                ))}
              </div>
            </section>
          ))}
        </div>

        <aside className="border-base-300 min-h-0 shrink-0 overflow-auto border-t lg:w-96 lg:border-t-0 lg:border-l">
          <style>{previewCss}</style>
          <ThemePreview mode={mode} />
        </aside>
      </div>

      {statusBar ? (
        <div className="border-base-300 text-base-content flex shrink-0 items-center gap-2 border-t px-3 py-1 text-xs">
          {statusBar}
        </div>
      ) : null}
    </div>
  );
}

/**
 * One color, with the thing nobody checks by eye: whether text on it can be read.
 *
 * silica derives each role's ink automatically, and `deriveContent` reports when
 * the best available answer still fails AA. Surfacing that here is the difference
 * between a theme editor and a color picker — a mid-tone, high-chroma brand
 * color has NO legible ink, and the author needs to know that while they are
 * choosing it rather than after a customer cannot read the button.
 */
function ColorField({
  token,
  value,
  ink,
  disabled,
  onChange,
}: {
  token: string;
  value: string;
  ink: string | undefined;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const label = TOKEN_LABELS[token] ?? token;
  const warning = useMemo(() => contrastWarning(token, value, ink), [token, value, ink]);

  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <Input
        key={`${token}:${value}`}
        defaultValue={value}
        disabled={disabled}
        placeholder="oklch(70% 0.15 20) or #FF6F86"
        onBlur={(event) => onChange(event.currentTarget.value.trim())}
      />
      {warning ? <FieldDescription>{warning}</FieldDescription> : null}
    </Field>
  );
}

/** The plain-English version of a contrast failure, or nothing. */
function contrastWarning(
  token: string,
  value: string,
  ink: string | undefined
): string | undefined {
  if (!value) return undefined;

  if (token === '--color-base-content') {
    return undefined;
  }

  if (token.startsWith('--color-base-')) {
    // Both sides have to parse before there is anything to measure. A color the
    // author is halfway through typing is not a contrast failure.
    const background = parseColor(value);
    const foreground = ink ? parseColor(ink) : undefined;
    if (!background || !foreground) return undefined;
    const ratio = contrastRatio(background, foreground);
    return ratio < AA_NORMAL
      ? `Text on this background is hard to read (${ratio.toFixed(1)}:1 — aim for ${AA_NORMAL}:1).`
      : undefined;
  }

  const derived = deriveContent(value);
  if (!derived) return undefined;
  return derived.passesAA
    ? undefined
    : 'No black or white text reads clearly on this color. Try making it darker or lighter.';
}
