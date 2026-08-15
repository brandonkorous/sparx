'use client';

// THE ESCAPE HATCH — a file nothing recognises.
//
// Twenty adapters cover twenty platforms, and a tenant's own spreadsheet is not one
// of them. Neither is the twenty-first competitor, or the CSV their bookkeeper has
// maintained since 2011. Without this screen every one of those people is told "we
// do not support your file", which is a strange thing to say about a list of products
// with the columns clearly labelled.
//
// So: pick what the file is, then say what each column means. Two rules keep it from
// being the tedious mapping grid every other importer makes you fill in:
//
//   It GUESSES first. A column called "Item Name" maps itself to Title, "How Much" to
//   Price, "Qty" to Quantity. The tenant is correcting a draft, not building one from
//   nothing, and on a well-labelled file there is often nothing left to correct.
//
//   It validates as you go, through the same validator the recognised path uses. The
//   moment a required field has a column, the count of importable rows appears — so
//   the screen tells you when you are finished instead of making you press a button
//   to find out.

import { useMemo, useState } from 'react';
import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Badge,
  Heading,
  Select,
  Text,
} from '@wizeworks/silicaui-react';
import {
  CANONICAL_ENTITIES,
  ENTITY_FIELDS,
  ENTITY_LABEL,
  mapManually,
  summarize,
  type CanonicalEntity,
  type MappedEntity,
  type SourceRow,
} from '@sparx/migration';

/** Compare form for a header — the same normalisation the adapters use. */
function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[\s_-]+/g, ' ')
    .replace(/[^a-z0-9 ]/g, '')
    .trim();
}

/**
 * Extra spellings worth recognising per field, beyond the field's own key and label.
 *
 * Deliberately short. A guess that is usually right and occasionally wrong is a good
 * draft; a guess that fires on anything vaguely similar teaches people to distrust the
 * whole screen and check every row by hand, which is the thing this exists to avoid.
 */
const ALIASES: Record<string, string[]> = {
  title: ['name', 'item name', 'product name', 'product', 'item', 'description short'],
  sku: ['item code', 'code', 'part number', 'part no', 'item number', 'stock code', 'mpn'],
  price: ['unit price', 'sell price', 'retail', 'rrp', 'how much', 'amount'],
  cost_per_item: ['cost', 'unit cost', 'buy price', 'wholesale', 'cost price'],
  quantity: ['qty', 'stock', 'on hand', 'in stock', 'inventory', 'available'],
  barcode: ['upc', 'ean', 'gtin', 'isbn'],
  email: ['e mail', 'email address', 'contact email', 'primary email'],
  phone: ['telephone', 'mobile', 'cell', 'contact number', 'phone number'],
  first_name: ['firstname', 'given name', 'forename'],
  last_name: ['lastname', 'surname', 'family name'],
  company: ['company name', 'business', 'organisation', 'organization', 'account'],
  name: ['full name', 'company name', 'contact name'],
  location: ['warehouse', 'store', 'shop', 'site', 'branch', 'depot'],
  description: ['details', 'body', 'long description', 'notes'],
  vendor: ['brand', 'manufacturer', 'make', 'supplier'],
  city: ['town', 'suburb'],
  zip: ['postcode', 'postal code', 'zip code'],
  province: ['state', 'region', 'county'],
  address1: ['address', 'street', 'address line 1', 'street address'],
  total: ['order total', 'grand total'],
  order_number: ['order', 'order id', 'order no', 'invoice number', 'reference'],
};

/** Best-guess mapping of the file's headers onto one entity's fields. */
export function guessMapping(entity: CanonicalEntity, headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  const taken = new Set<string>();

  for (const header of headers) {
    const wanted = normalize(header);
    if (wanted === '') continue;

    const match = ENTITY_FIELDS[entity].find((field) => {
      if (taken.has(field.key)) return false;
      if (normalize(field.key) === wanted) return true;
      if (normalize(field.label) === wanted) return true;
      return (ALIASES[field.key] ?? []).some((alias) => normalize(alias) === wanted);
    });

    if (match !== undefined) {
      mapping[header] = match.key;
      taken.add(match.key);
    }
  }

  return mapping;
}

/**
 * Which entity a set of headers most looks like.
 *
 * Scored by how many of that entity's REQUIRED and key fields a guess can fill, so a
 * file with SKU and Price lands on products rather than on the first entity in the
 * list that happens to have a `name` column.
 */
export function guessEntity(headers: string[]): CanonicalEntity {
  let best: CanonicalEntity = 'products';
  let bestScore = -1;

  for (const entity of CANONICAL_ENTITIES) {
    const mapping = guessMapping(entity, headers);
    const mapped = new Set(Object.values(mapping));
    const fields = ENTITY_FIELDS[entity];
    const required = fields.filter((field) => field.required === true);
    const keys = fields.filter((field) => field.naturalKey === true);

    // Required fields are worth most: an entity whose required column is absent
    // cannot be the answer no matter how many optional ones happen to line up.
    const score =
      required.filter((field) => mapped.has(field.key)).length * 5 +
      keys.filter((field) => mapped.has(field.key)).length * 3 +
      mapped.size;

    if (score > bestScore) {
      bestScore = score;
      best = entity;
    }
  }

  return best;
}

export interface ColumnMapperProps {
  headers: string[];
  raw: SourceRow[];
  /** Called whenever the mapping produces a different result, so the surface can
   *  enable its Import button and show the count. */
  onChange: (mapped: MappedEntity | null) => void;
}

export function ColumnMapper({ headers, raw, onChange }: ColumnMapperProps) {
  const [entity, setEntity] = useState<CanonicalEntity>(() => guessEntity(headers));
  const [mapping, setMapping] = useState<Record<string, string>>(() =>
    guessMapping(guessEntity(headers), headers)
  );

  const mapped = useMemo(() => mapManually(entity, raw, mapping), [entity, raw, mapping]);

  // Report upward on every change. `useMemo` above makes this cheap enough to do in
  // render for a file of a few thousand rows; anything larger is chunked by the API
  // anyway and the validator is linear.
  const signature = `${entity}:${mapped.report.okCount}:${mapped.report.errorCount}:${mapped.report.blocked}`;
  const [lastSignature, setLastSignature] = useState<string | null>(null);
  if (signature !== lastSignature) {
    setLastSignature(signature);
    onChange(mapped.report.blocked ? null : mapped);
  }

  const fields = ENTITY_FIELDS[entity];
  const guessedCount = Object.keys(mapping).length;

  return (
    <div className="flex flex-col gap-4">
      <Alert color="info" variant="soft">
        <AlertContent>
          <AlertTitle>Tell us what this file is</AlertTitle>
          <AlertDescription>
            We had a go at matching {guessedCount} of {headers.length} columns. Change anything we
            got wrong — the count at the bottom updates as you go.
          </AlertDescription>
        </AlertContent>
      </Alert>

      <div className="border-base-300 bg-base-100 flex flex-col gap-3 rounded-xl border p-4">
        <label className="flex flex-col gap-1.5">
          <Text className="font-medium">What is in this file?</Text>
          <Select
            value={entity}
            onValueChange={(next) => {
              const chosen = next as CanonicalEntity;
              setEntity(chosen);
              // Re-guess against the new entity rather than keeping a mapping built
              // for a different set of fields, which would leave stale keys behind.
              setMapping(guessMapping(chosen, headers));
            }}
          >
            {CANONICAL_ENTITIES.map((option) => (
              <option key={option} value={option}>
                {ENTITY_LABEL[option].many}
              </option>
            ))}
          </Select>
        </label>
      </div>

      <div className="border-base-300 bg-base-100 flex flex-col rounded-xl border">
        <div className="border-base-300 flex items-center justify-between gap-2 border-b p-4">
          <Heading level={3} className="text-base">
            Your columns
          </Heading>
          <Badge color="neutral" variant="outline" size="sm">
            {headers.length} in this file
          </Badge>
        </div>

        <div className="divide-base-300 max-h-96 divide-y overflow-y-auto">
          {headers.map((header) => {
            const sample = raw.find((row) => (row[header] ?? '').trim() !== '')?.[header] ?? '';
            const chosen = mapping[header] ?? '';
            const spec = fields.find((field) => field.key === chosen);

            return (
              <div key={header} className="grid gap-2 p-3 @2xl:grid-cols-2 @2xl:items-center">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <Text className="font-medium">{header}</Text>
                  {sample !== '' ? (
                    <Text className="truncate text-sm">
                      e.g. {sample.length > 60 ? `${sample.slice(0, 57)}…` : sample}
                    </Text>
                  ) : (
                    <Text className="text-sm">This column is empty in every row.</Text>
                  )}
                </div>

                <div className="flex flex-col gap-1">
                  <Select
                    value={chosen}
                    onValueChange={(value) =>
                      setMapping((current) => {
                        // Select hands back `unknown`; every option's value here is a
                        // field key we put there ourselves.
                        const next = String(value);
                        const updated = { ...current };
                        if (next === '') delete updated[header];
                        // One field, one column — picking a field that is already
                        // spoken for moves it rather than silently mapping twice.
                        else {
                          for (const [key, value] of Object.entries(updated)) {
                            if (value === next && key !== header) delete updated[key];
                          }
                          updated[header] = next;
                        }
                        return updated;
                      })
                    }
                  >
                    <option value="">Leave this column out</option>
                    {fields.map((field) => (
                      <option key={field.key} value={field.key}>
                        {field.label}
                        {field.required === true ? ' (needed)' : ''}
                      </option>
                    ))}
                  </Select>
                  {spec?.help !== undefined ? <Text className="text-sm">{spec.help}</Text> : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Alert
        color={
          mapped.report.blocked ? 'danger' : mapped.report.errorCount > 0 ? 'warning' : 'success'
        }
        variant="soft"
      >
        <AlertContent>
          <AlertTitle>{summarize(mapped.report)}</AlertTitle>
          {mapped.report.blocked ? (
            <AlertDescription>
              {mapped.report.issues
                .filter((issue) => issue.rowIndex === -1)
                .map((issue) => issue.message)
                .join(' ')}
            </AlertDescription>
          ) : null}
        </AlertContent>
      </Alert>
    </div>
  );
}
