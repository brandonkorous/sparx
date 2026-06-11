'use client';

import * as React from 'react';
import { Button, Input, Label, Spinner, Text } from '@sparx/ui';
import { Check } from 'lucide-react';
import type { SlugCheck } from './onboarding-wizard';

const STORE_ZONE = 'sparx.zone';

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

  return (
    <div className="max-w-xl rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-6">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <Label htmlFor="ws-company">Company name</Label>
          <Input
            id="ws-company"
            value={companyName}
            onChange={(e) => onCompany(e.target.value)}
            placeholder="Bob's Barbers"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="ws-slug">Workspace address</Label>
          <div className="flex items-center gap-2">
            <Input
              id="ws-slug"
              value={slug}
              onChange={(e) => onSlug(e.target.value)}
              placeholder="bobs-barbers"
              className="flex-1"
              autoCapitalize="none"
              autoComplete="off"
              spellCheck={false}
            />
            <Text variant="muted" className="whitespace-nowrap">
              .{STORE_ZONE}
            </Text>
          </div>
          {check.status === 'checking' && (
            <div className="flex items-center gap-2">
              <Spinner size="sm" />
              <Text size="xs" variant="muted">
                Checking availability…
              </Text>
            </div>
          )}
          {!unchangedSlug && check.status === 'done' && check.result.available && (
            <div className="flex items-center gap-1.5">
              <Check className="h-4 w-4 text-[var(--color-success-text)]" />
              <Text size="xs" className="text-[var(--color-success-text)]">
                {normalized}.{STORE_ZONE} is available
              </Text>
            </div>
          )}
          {!unchangedSlug && check.status === 'done' && !check.result.available && (
            <div className="flex flex-col gap-1">
              <Text size="xs" variant="danger">
                {REASON_COPY[check.result.reason] ?? 'That address is unavailable.'}
              </Text>
              {check.result.suggestions.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <Text size="xs" variant="muted">
                    Try:
                  </Text>
                  {check.result.suggestions.map((s) => (
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
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="ws-site">
            Site name{' '}
            <span className="font-normal text-[var(--color-text-tertiary)]">
              · you can add more sites later
            </span>
          </Label>
          <Input
            id="ws-site"
            value={siteName}
            onChange={(e) => onSite(e.target.value)}
            placeholder="Primary"
          />
        </div>
      </div>
    </div>
  );
}
