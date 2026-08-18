'use client';

// Inventing a color.
//
// This is the thing silica does that a fixed palette cannot: a name coined here
// gets `bg-<name>`, `btn-<name>`, `badge-<name>` and the rest, generated at
// runtime from silica's own rules, with no rebuild and no code change. So the
// editor has to offer it — a theme system whose palette is closed is just eight
// colors with extra steps.
//
// The name becomes a CSS SELECTOR, so it is validated here rather than trusted.
// A color called `x{}body{display:none}` is not a color.

import { useState } from 'react';
import {
  Button,
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  Input,
} from '@wizeworks/silicaui-react';
import { rolesOf, SURFACE_TOKENS } from '@wizeworks/silicaui-html';
import type { ThemeDoc } from '../../documents/types';
import { useDoc } from '../context';
import { StudioIcon } from '../icon';
import { ColorValue } from './color-tile';
import { useThemeEdit } from './edit-context';

const NAME_RE = /^[a-z][a-z0-9-]*$/;
const MAX_NAME = 48;

export function AddColor() {
  const doc = useDoc<ThemeDoc>();
  const { editable, setToken } = useThemeEdit();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [value, setValue] = useState('oklch(0.7 0.15 250)');

  if (!editable) return null;

  const slug = name.trim().toLowerCase();
  const problem = validate(slug, doc);

  const add = () => {
    if (problem) return;
    setToken(`--color-${slug}`, value, `Add ${slug}`);
    setName('');
    setOpen(false);
  };

  if (!open) {
    return (
      <Button size="sm" color="primary" variant="soft" onClick={() => setOpen(true)}>
        <StudioIcon name="plus" className="text-base" />
        Add a color
      </Button>
    );
  }

  return (
    <div className="border-base-300 rounded-box border p-3">
      <Field>
        <FieldLabel className="text-base">What is it called?</FieldLabel>
        <div className="flex items-center gap-2">
          <ColorValue label="The new color" value={value} disabled={false} onChange={setValue} />
          <Input
            value={name}
            placeholder="sale"
            maxLength={MAX_NAME}
            onChange={(event) => setName(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') add();
              if (event.key === 'Escape') setOpen(false);
            }}
          />
        </div>
        {problem && name ? (
          <FieldError>{problem}</FieldError>
        ) : (
          <FieldDescription>
            One word, lowercase. It works everywhere the built-in colors do — buttons, badges,
            alerts and the rest.
          </FieldDescription>
        )}
      </Field>
      <div className="mt-3 flex gap-2">
        <Button size="sm" color="primary" disabled={Boolean(problem)} onClick={add}>
          Add it
        </Button>
        <Button size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

/** Why this name cannot be used, or nothing. */
function validate(slug: string, doc: ThemeDoc): string | undefined {
  if (!slug) return 'Give it a name.';
  if (!NAME_RE.test(slug)) return 'Letters, numbers and dashes only, starting with a letter.';
  if (slug.endsWith('-content')) return 'That ending is reserved — the text color is made for you.';
  if (SURFACE_TOKENS.some((surface) => surface === slug))
    return 'That name belongs to one of the page layers.';
  if (rolesOf(doc.theme).includes(slug)) return 'You already have a color with that name.';
  return undefined;
}
