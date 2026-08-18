'use client';

// "Which of your sites does this apply to?" — the one control behind Model B
// per-site scoping (docs/49 §3, docs/131 §4).
//
// The data rule it expresses: an EMPTY list means every site, and that is also the
// default, so a single-site business never sees this and nothing it owns carries a
// link. Ticking sites narrows it.
//
// It exists as one component because the same picker had already been hand-copied
// onto categories and collections, and per-site scoping now reaches five entities —
// resources, discounts and price lists among them, where getting it wrong is a
// person double-booked or a price charged wrong. Copies drift; the wording, the
// "you cannot untick the last one" guard, and the meaning of an empty list have to
// be identical everywhere or the same screen teaches two different rules.
//
// Renders NOTHING for a tenant with one site: there is no choice to make, and an
// always-on toggle reading "every site" is noise on the 99% case.

import {
  Checkbox,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  Switch,
  Text,
} from '@wizeworks/silicaui-react';

import { FormSection } from './form-section';
import { useActiveSiteId } from '../lib/api/shell-data';
import { useSites } from '../surfaces/sites/data';

interface SiteScopeFieldProps {
  /** The current set. EMPTY = every site. */
  value: string[];
  onChange: (next: string[]) => void;
  /** Section heading — say what the THING is, e.g. "Which of your sites sell it". */
  title: string;
  /** One line, in the owner's language, on what narrowing actually does for them. */
  description: string;
  /** The switch label. Defaults to the plain form; override where a noun reads
   *  better ("Available to every site" for a person). */
  everyLabel?: string;
}

export function SiteScopeField({
  value,
  onChange,
  title,
  description,
  everyLabel = 'Show it on every site',
}: SiteScopeFieldProps) {
  const { data: sites } = useSites();
  const { data: activeSite } = useActiveSiteId();

  // One site (or the list hasn't loaded) — there is no scoping decision to make.
  if ((sites ?? []).length <= 1) return null;

  const everySite = value.length === 0;

  return (
    <FormSection title={title} description={description}>
      <Field>
        <FieldLabel>{everyLabel}</FieldLabel>
        <FieldControl
          render={
            <Switch
              color="module"
              checked={everySite}
              onCheckedChange={(next: boolean) => {
                // Turning it OFF has to land on a real site, or the empty list would
                // silently still mean "everywhere". Prefer the site being worked in.
                onChange(
                  next
                    ? []
                    : activeSite?.propertyId
                      ? [activeSite.propertyId]
                      : [(sites ?? [])[0]?.id ?? '']
                );
              }}
            />
          }
        />
        <FieldDescription>Turn this off to choose the sites it applies to.</FieldDescription>
      </Field>

      {everySite ? null : (
        <div className="flex flex-col gap-2">
          {(sites ?? []).map((site) => (
            <label key={site.id} className="flex items-center gap-2">
              <Checkbox
                color="module"
                checked={value.includes(site.id)}
                aria-label={site.name}
                onChange={(event) => {
                  const next = event.target.checked
                    ? [...value, site.id]
                    : value.filter((id) => id !== site.id);
                  // Unticking the LAST one would empty the list, which means the
                  // opposite of what the person is doing — refuse it instead.
                  onChange(next.length === 0 ? value : [...next].sort());
                }}
              />
              <Text as="span">{site.name}</Text>
            </label>
          ))}
        </div>
      )}
    </FormSection>
  );
}
