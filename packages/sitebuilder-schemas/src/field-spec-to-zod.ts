// fieldSpecToZod — compile a custom section's `SectionField[]` into a Zod
// validator (docs/38 §4.2; docs/handoffs/sitebuilder-custom-section-template-spec.md §6).
//
// Code sections hand-write their config schema (e.g. HeroConfig). Custom
// sections don't: their config contract is DERIVED from the same field
// descriptor the dashboard renders the inspector form from, so `parseSectionConfig`
// validates + defaults a custom config exactly as it does a code section. The
// derived schema's bounds mirror the defaults used across the stock sections.

import { z } from 'zod';
import { MediaRef, LinkUrl } from './common';
import type { SectionField } from './fields';

// Text bounds by field type — generous but finite (a config is JSON in a row).
const TEXT_MAX = 500;
const TEXTAREA_MAX = 4000;
const RICHTEXT_MAX = 20000;
// A custom section's list field caps at the template's 50-iteration ceiling.
const LIST_MAX = 50;

function fieldToZod(field: SectionField): z.ZodTypeAny {
  switch (field.type) {
    case 'text':
      return z.string().max(TEXT_MAX).default('');
    case 'textarea':
      return z.string().max(TEXTAREA_MAX).default('');
    case 'richtext':
      // Stored raw; sanitized at render by the interpreter (never trusted markup).
      return z.string().max(RICHTEXT_MAX).default('');
    case 'url':
      return LinkUrl.default('');
    case 'select':
    case 'buttongroup': {
      const [first, ...rest] = (field.options ?? []).map((o) => o.value);
      if (first === undefined) return z.string().default('');
      return z.enum([first, ...rest]).default(first);
    }
    case 'number':
    case 'range': {
      let schema = z.number();
      if (typeof field.min === 'number') schema = schema.min(field.min);
      if (typeof field.max === 'number') schema = schema.max(field.max);
      return schema.default(field.min ?? 0);
    }
    case 'boolean':
      return z.boolean().default(false);
    case 'color':
    case 'font':
      // A token KEY (resolved to a `--sf-*` value at render), never a raw value.
      // v1 accepts a bounded string; a token-key enum is a follow-up.
      return z.string().max(64).default('');
    case 'media':
      return MediaRef.optional().nullable();
    case 'collection':
      return z.string().uuid().optional().nullable();
    case 'products':
      return z.array(z.string().uuid()).max(100).default([]);
    case 'list': {
      const item = field.itemFields ? fieldSpecToZod(field.itemFields) : z.object({});
      return z.array(item).max(LIST_MAX).default([]);
    }
    default: {
      // Exhaustiveness guard — a new SectionFieldType must be handled here.
      const _never: never = field.type;
      throw new Error(`fieldSpecToZod: unhandled field type ${String(_never)}`);
    }
  }
}

/** Compile a field spec into an object schema that validates + defaults a
 *  custom section's config. Duplicate keys: last wins (mirrors object shape). */
export function fieldSpecToZod(fields: SectionField[]): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const field of fields) {
    shape[field.key] = fieldToZod(field);
  }
  return z.object(shape);
}
