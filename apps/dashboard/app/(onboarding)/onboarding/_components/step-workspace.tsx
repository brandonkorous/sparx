'use client';

import * as React from 'react';
import {
  Button,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  FieldStatus,
  Loading,
} from '@wizeworks/silicaui-react';
import { rule, useFieldValidation } from '@sparx/forms';
import type { SlugCheck } from './onboarding-wizard';

const SITE_ZONE = 'sparx.zone';

const REASON_COPY: Record<string, string> = {
  invalid: 'Use lowercase letters, numbers, and hyphens (3–63 characters).',
  reserved: 'That address is reserved — try another.',
  taken: 'That address is already taken — try another.',
};

// Step 3 — Workspace (work pane). A controlled form: company name, the storefront
// address (slug, with live availability), and the first site name. All values are
// lifted to the orchestrator so the setup card echoes the address live and the
// card's Continue can save them. The slug is the LAST chance to change the address
// before launch locks it.
export function StepWorkspace({
  companyName,
  slug,
  siteName,
  onCompany,
  onSlug,
  onSite,
  check,
  unchangedSlug,
}: {
  companyName: string;
  slug: string;
  siteName: string;
  onCompany: (v: string) => void;
  onSlug: (v: string) => void;
  onSite: (v: string) => void;
  check: SlugCheck;
  unchangedSlug: boolean;
}) {
  const normalized = slug.trim().toLowerCase();

  // Company + site are simple required fields (errors reveal on blur, so a
  // pre-filled form is never a wall of red). The slug carries its OWN live
  // availability status below — it's async (checked in the orchestrator), so it
  // drives the Field accent directly rather than through the sync rule engine.
  const v = useFieldValidation(
    { companyName, siteName },
    {
      companyName: rule.required('Add a company name.'),
      siteName: rule.required('Name your first site.'),
    }
  );

  // Narrow the availability result once (null until a fresh, changed slug resolves)
  // so both the Field accent and the message rows below read from it type-safely.
  const result = !unchangedSlug && check.status === 'done' ? check.result : null;
  const slugAvailable = result?.available === true;
  const slugUnavailable = result != null && !result.available;

  return (
    <div className="border-base-300 bg-base-100 max-w-xl rounded-xl border p-6">
      <div className="flex flex-col gap-5">
        <Field {...v.field('companyName')}>
          <FieldLabel required>Company name</FieldLabel>
          <FieldControl
            name="companyName"
            value={companyName}
            onChange={(e) => onCompany(e.target.value)}
            placeholder="Bob's Barbers"
            {...v.control('companyName')}
          />
        </Field>

        <Field status={slugUnavailable ? 'error' : slugAvailable ? 'success' : undefined}>
          <FieldLabel required>Workspace address</FieldLabel>
          <div className="flex items-center gap-2">
            <FieldControl
              name="slug"
              value={slug}
              onChange={(e) => onSlug(e.target.value)}
              placeholder="bobs-barbers"
              className="flex-1"
              autoCapitalize="none"
              autoComplete="off"
              spellCheck={false}
            />
            <p className="text-base-content/70 whitespace-nowrap">.{SITE_ZONE}</p>
          </div>
          {check.status === 'checking' && (
            <div className="flex items-center gap-2">
              <Loading size="sm" />
              <p className="text-base-content/70 text-xs">Checking availability…</p>
            </div>
          )}
          {result?.available && (
            <FieldStatus status="success" attached={false}>
              {normalized}.{SITE_ZONE} is available
            </FieldStatus>
          )}
          {result && !result.available && (
            <div className="flex flex-col gap-1">
              <FieldStatus status="error" attached={false}>
                {REASON_COPY[result.reason] ?? 'That address is unavailable.'}
              </FieldStatus>
              {result.suggestions.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-base-content/70 text-xs">Try:</p>
                  {result.suggestions.map((s) => (
                    <Button
                      key={s}
                      color="module"
                      variant="link"
                      size="sm"
                      onClick={() => onSlug(s)}
                    >
                      {s}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          )}
        </Field>

        <Field {...v.field('siteName')}>
          <FieldLabel required>Site name</FieldLabel>
          <FieldControl
            name="siteName"
            value={siteName}
            onChange={(e) => onSite(e.target.value)}
            placeholder="Primary"
            {...v.control('siteName')}
          />
          <FieldDescription>You can add more sites later.</FieldDescription>
        </Field>
      </div>
    </div>
  );
}
