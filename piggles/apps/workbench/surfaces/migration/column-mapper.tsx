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
} from '@wizeworks/migration';
import { guessEntity, guessMapping } from './column-guess';

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

  // Silica's Select reads its TRIGGER label from `items`, not from the options —
  // without these the closed control printed the raw field key, so the screen asked
  // a clothes shop to confirm `province` and `accepts_marketing` (persona issue 229).
  const entityLabels = Object.fromEntries(
    CANONICAL_ENTITIES.map((option) => [option, ENTITY_LABEL[option].many])
  );
  const fieldLabels: Record<string, string> = {
    '': 'Leave this column out',
    ...Object.fromEntries(
      fields.map((field) => [
        field.key,
        `${field.label}${field.required === true ? ' (needed)' : ''}`,
      ])
    ),
  };

  return (
    <div className="flex flex-col gap-4">
      <Alert color="info">
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
            items={entityLabels}
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
                    items={fieldLabels}
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
