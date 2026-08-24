'use client';

// Which of the business's websites this product appears on. Only a section at
// all when there is genuinely a choice — on one site it would be a control with
// one option.

import {
  Checkbox,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  Switch,
  Text,
} from '@wizeworks/silicaui-react';
import { FormSection } from '../../components/form-section';
import { useActivePropertyId } from '../../lib/api/shell-data';
import { useSites } from '../sites/data';
import type { Draft } from './product-overview-draft';

export function ProductSites({
  draft,
  set,
}: {
  draft: Draft;
  set: <K extends keyof Draft>(key: K, value: Draft[K]) => void;
}) {
  const { data: sites } = useSites();
  const activeSiteId = useActivePropertyId();
  if ((sites ?? []).length <= 1) return null;

  return (
    <FormSection
      title="Which of your sites show it"
      description="You run more than one website, so a product can belong to all of them or to just some."
    >
      <Field>
        <FieldLabel>Show it on every site</FieldLabel>
        <FieldControl
          render={
            <Switch
              color="module"
              checked={draft.propertyIds.length === 0}
              onCheckedChange={(next: boolean) => {
                // Empty IS "everywhere" in the stored model. Turning the
                // switch off has to seed something, or the product would
                // silently stay everywhere while the UI showed otherwise —
                // so it seeds the site being worked in.
                set('propertyIds', next ? [] : [activeSiteId ?? (sites ?? [])[0]?.id ?? '']);
              }}
            />
          }
        />
        <FieldDescription>Turn this off to choose the sites it appears on.</FieldDescription>
      </Field>

      {draft.propertyIds.length === 0 ? null : (
        <div className="flex flex-col gap-2">
          {(sites ?? []).map((site) => (
            <label key={site.id} className="flex items-center gap-2">
              <Checkbox
                color="module"
                checked={draft.propertyIds.includes(site.id)}
                aria-label={site.name}
                onChange={(event) => {
                  const next = event.target.checked
                    ? [...draft.propertyIds, site.id]
                    : draft.propertyIds.filter((value) => value !== site.id);
                  // Unticking the last one would mean "everywhere", which is
                  // the opposite of what the person just did.
                  set('propertyIds', next.length === 0 ? draft.propertyIds : next);
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
