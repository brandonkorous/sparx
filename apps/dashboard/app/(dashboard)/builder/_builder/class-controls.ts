// Phase C control registry (docs/47 §11): the structured colour / variant
// selectors shown in the inspector's Style panel. Each control owns a
// mutually-exclusive class group on `node.class`; reading & writing go through
// the pure class-group helpers in @sparx/builder-schemas.
//
// The vocabulary MIRRORS @sparx/site-ui's recipe (COLOR_KEYS / treatmentVariants,
// docs/46 §3.6) and is hardcoded here exactly like the other inspector option
// tables (model.ts: SURFACE_OPTIONS, GAP_OPTIONS, …). It is a versioned class
// contract (docs/47 §7) — keep it in sync if the recipe gains a slot.

import { readClassGroup, setClassGroup } from '@sparx/builder-schemas';

export interface ClassOption {
  value: string;
  label: string;
  /** The class token this option writes (e.g. `sf-c-primary`). */
  token: string;
}

export interface ClassControl {
  id: string;
  label: string;
  options: ClassOption[];
}

// Recipe vocabulary (docs/46 §3.6). `surface` is the neutral page-surface slot.
const COLOR_KEYS = [
  'primary',
  'secondary',
  'accent',
  'neutral',
  'info',
  'success',
  'warning',
  'danger',
  'highlight',
  'surface',
] as const;

const TREATMENT_KEYS = ['solid', 'soft', 'outline', 'dashed', 'ghost', 'link', 'glass'] as const;

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

export const COLOR_CONTROL: ClassControl = {
  id: 'color',
  label: 'Color',
  options: COLOR_KEYS.map((k) => ({ value: k, label: cap(k), token: `sf-c-${k}` })),
};

export const VARIANT_CONTROL: ClassControl = {
  id: 'variant',
  label: 'Variant',
  options: TREATMENT_KEYS.map((k) => ({ value: k, label: cap(k), token: `sf-v-${k}` })),
};

/** The controls rendered, in order, in the inspector Style panel. */
export const STYLE_CONTROLS: ClassControl[] = [COLOR_CONTROL, VARIANT_CONTROL];

const groupTokens = (control: ClassControl): string[] => control.options.map((o) => o.token);

/** The active option VALUE for a control given a node's class string, or null. */
export function activeValue(classStr: string | undefined, control: ClassControl): string | null {
  const token = readClassGroup(classStr, groupTokens(control));
  return token ? (control.options.find((o) => o.token === token)?.value ?? null) : null;
}

/** Apply an option value (or clear with null) → the new class string. */
export function applyValue(
  classStr: string | undefined,
  control: ClassControl,
  value: string | null
): string {
  const token = value ? (control.options.find((o) => o.value === value)?.token ?? null) : null;
  return setClassGroup(classStr, groupTokens(control), token);
}
