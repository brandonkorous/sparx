'use client';

// Section Studio index — the tenant's custom section types as a card grid, with
// a "New section" action. Each card opens the authoring editor. Full-width in the
// editor shell (the Studio brings its own preview).

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Badge, Button, Card, EmptyState, PageHeader } from '@sparx/ui';
import { Blocks, Plus } from 'lucide-react';
import type { CustomDefinitionDto } from '../_lib/types';

export function SectionsIndex({ definitions }: { definitions: CustomDefinitionDto[] }) {
  const router = useRouter();
  const sorted = React.useMemo(
    () => [...definitions].sort((a, b) => a.label.localeCompare(b.label)),
    [definitions]
  );

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6">
      <PageHeader
        icon={<Blocks className="h-5 w-5" />}
        title="Sections"
        description="Build your own section types — fields plus a render template — and place them on any layout. No code, no deploy."
        actions={
          <Button onClick={() => router.push('/sitebuilder/sections/new')}>
            <Plus className="h-4 w-4" />
            New section
          </Button>
        }
      />

      {sorted.length === 0 ? (
        <EmptyState
          title="No custom sections yet"
          description="Create a reusable section type your team can drop into any page — a feature grid, a spec table, a callout, anything."
          action={
            <Button onClick={() => router.push('/sitebuilder/sections/new')}>
              <Plus className="h-4 w-4" />
              Create your first section
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((def) => (
            <Link key={def.slug} href={`/sitebuilder/sections/${encodeURIComponent(def.slug)}`}>
              <Card variant="module" className="h-full p-4 transition-shadow hover:shadow-md">
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold text-[var(--color-text-primary)]">
                      {def.label}
                    </span>
                    {def.binding ? (
                      <Badge color="module" variant="soft" size="sm">
                        {def.binding}
                      </Badge>
                    ) : null}
                  </div>
                  <span className="font-mono text-xs text-[var(--color-text-muted)]">
                    custom:{def.slug}
                  </span>
                  {def.description ? (
                    <p className="line-clamp-2 text-xs text-[var(--color-text-muted)]">
                      {def.description}
                    </p>
                  ) : null}
                  <span className="mt-1 text-xs text-[var(--color-text-tertiary)]">
                    v{def.version}
                  </span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
