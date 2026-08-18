// sparx field-schema — the neutral typed-field vocabulary.
//
// A `FieldSchema` describes the shape of a JSONB bag as an ordered list of
// typed fields. It is domain-agnostic on purpose: the exact same definition
// drives two domains that share nothing else —
//
//   - @wizeworks/cms-schemas re-exports it as `ContentTypeSchema` to describe a
//     `content_entries.body` (a content type's fields).
//   - @wizeworks/commerce-schemas re-exports it as `ProductTypeSchema` to describe
//     a `commerce_products.attributes` bag (a product type's attributes).
//
// Whichever domain consumes it, a field's `key` is camelCase to match the
// JSONB key; the runtime validator lives in ./validate.
//
// This module was extracted out of @wizeworks/cms-schemas (docs/143 §3) so that a
// single field engine backs both content and product types — the "single
// point of change" rule (root CLAUDE.md RULE #1) applied to the field system
// itself. cms-schemas re-exports every symbol here unchanged for back-compat.

import { z } from 'zod';

const FieldKey = z
  .string()
  .min(1)
  .max(63)
  .regex(/^[a-z][a-zA-Z0-9_]*$/, 'Field key must be camelCase starting with a lowercase letter.');

const BaseField = z.object({
  key: FieldKey,
  label: z.string().min(1).max(120),
  helpText: z.string().max(500).optional(),
  required: z.boolean().optional(),
});

const TextField = BaseField.extend({
  type: z.literal('text'),
  min: z.number().int().min(0).optional(),
  max: z.number().int().min(1).max(10_000).optional(),
  pattern: z.string().optional(),
  placeholder: z.string().optional(),
  default: z.string().optional(),
});

const LongTextField = BaseField.extend({
  type: z.literal('long_text'),
  min: z.number().int().min(0).optional(),
  max: z.number().int().min(1).max(100_000).optional(),
  rows: z.number().int().min(1).max(40).optional(),
});

const RichTextField = BaseField.extend({
  type: z.literal('rich_text'),
});

const SlugField = BaseField.extend({
  type: z.literal('slug'),
  sourceField: FieldKey.optional(),
  max: z.number().int().min(1).max(255).optional(),
});

const NumberField = BaseField.extend({
  type: z.literal('number'),
  min: z.number().optional(),
  max: z.number().optional(),
  integer: z.boolean().optional(),
});

const BooleanField = BaseField.extend({
  type: z.literal('boolean'),
  default: z.boolean().optional(),
});

const DateField = BaseField.extend({
  type: z.literal('date'),
});

const DateTimeField = BaseField.extend({
  type: z.literal('datetime'),
});

const EnumField = BaseField.extend({
  type: z.literal('enum'),
  options: z
    .array(z.object({ value: z.string().min(1), label: z.string().min(1) }))
    .min(1)
    .max(64),
  multiple: z.boolean().optional(),
});

const UrlField = BaseField.extend({
  type: z.literal('url'),
});

const EmailField = BaseField.extend({
  type: z.literal('email'),
});

const ReferenceField = BaseField.extend({
  type: z.literal('reference'),
  to: z.string().min(1).max(63), // target type key (content type / product type)
  multiple: z.boolean().optional(),
  min: z.number().int().min(0).optional(),
  max: z.number().int().min(1).optional(),
});

const AssetField = BaseField.extend({
  type: z.literal('asset'),
  accept: z.array(z.string()).optional(), // mime patterns, e.g. ['image/*']
  multiple: z.boolean().optional(),
});

// ── Three types the CRM needed, added HERE rather than forked (docs/144 §3.3).
// A field engine with a per-domain dialect is two field engines; the moment CMS
// or commerce wants "amount of money" or "which of our people", it is already
// here (root CLAUDE.md RULE #1 — improve where it propagates).

// Money. An amount ALWAYS travels with its currency code, because a bare number
// is only meaningful next to one — and a business that sells in two currencies
// would otherwise silently compare them.
const CurrencyField = BaseField.extend({
  type: z.literal('currency'),
  /** Pre-filled currency code for new values. The stored value carries its own. */
  currency: z.string().length(3).optional(),
  min: z.number().optional(),
  max: z.number().optional(),
});

// One of our own people — an owner, an approver, a technician. A uuid pointing
// at a staff user; the renderer turns it into a name.
const UserField = BaseField.extend({
  type: z.literal('user'),
  multiple: z.boolean().optional(),
});

// A read-only number worked out from the OTHER fields on the same record —
// margin from price and cost, days from a duration. Never accepted from a
// client: the server computes it on write (see ./calc) and overwrites whatever
// arrived, so a stale or hostile value cannot be stored.
const CalculatedField = BaseField.extend({
  type: z.literal('calculated'),
  /** Arithmetic over sibling field keys — see ./calc for the grammar. */
  expression: z.string().min(1).max(500),
  resultType: z.enum(['number', 'currency']).optional(),
  /** Decimal places to round to. Omitted = no rounding. */
  precision: z.number().int().min(0).max(6).optional(),
  currency: z.string().length(3).optional(),
});

// `object` and `repeater` need recursion. Zod 4 handles this via z.lazy().
// We declare the TS types up-front, then build the Zod schema with lazy
// references to the union — the union itself is exported as FieldDefSchema.

export type ObjectFieldDef = z.infer<typeof BaseField> & {
  type: 'object';
  fields: FieldDef[];
};

export type RepeaterFieldDef = z.infer<typeof BaseField> & {
  type: 'repeater';
  itemLabel?: string;
  min?: number;
  max?: number;
  fields: FieldDef[];
};

export type FieldDef =
  | z.infer<typeof TextField>
  | z.infer<typeof LongTextField>
  | z.infer<typeof RichTextField>
  | z.infer<typeof SlugField>
  | z.infer<typeof NumberField>
  | z.infer<typeof BooleanField>
  | z.infer<typeof DateField>
  | z.infer<typeof DateTimeField>
  | z.infer<typeof EnumField>
  | z.infer<typeof UrlField>
  | z.infer<typeof EmailField>
  | z.infer<typeof ReferenceField>
  | z.infer<typeof AssetField>
  | z.infer<typeof CurrencyField>
  | z.infer<typeof UserField>
  | z.infer<typeof CalculatedField>
  | ObjectFieldDef
  | RepeaterFieldDef;

// z.lazy + z.discriminatedUnion don't compose in Zod 4 — discriminatedUnion
// needs static .shape access on each branch, but lazy hides it. z.union
// covers the same ground (each branch is still uniquely discriminated by
// `type`); the perf delta on schemas of ~15 branches is negligible because
// this validator runs only when a tenant defines a custom type, not on every
// entry/product write.

const ObjectField = z.lazy(() =>
  BaseField.extend({
    type: z.literal('object'),
    fields: z.array(FieldDefSchema),
  })
);

const RepeaterField = z.lazy(() =>
  BaseField.extend({
    type: z.literal('repeater'),
    itemLabel: z.string().max(120).optional(),
    min: z.number().int().min(0).optional(),
    max: z.number().int().min(1).optional(),
    fields: z.array(FieldDefSchema),
  })
);

export const FieldDefSchema: z.ZodType<FieldDef> = z.lazy(() =>
  z.union([
    TextField,
    LongTextField,
    RichTextField,
    SlugField,
    NumberField,
    BooleanField,
    DateField,
    DateTimeField,
    EnumField,
    UrlField,
    EmailField,
    ReferenceField,
    AssetField,
    CurrencyField,
    UserField,
    CalculatedField,
    ObjectField,
    RepeaterField,
  ])
);

/** A money value as stored — the amount never travels without its code. */
export interface CurrencyValue {
  amount: number;
  currency: string;
}

// The whole-schema shape: an ordered, non-empty list of typed fields. cms-schemas
// re-exports this value+type as `ContentTypeSchema`; commerce-schemas as
// `ProductTypeSchema`.
export const FieldSchema = z.object({
  fields: z.array(FieldDefSchema).min(1),
});
export type FieldSchema = z.infer<typeof FieldSchema>;
