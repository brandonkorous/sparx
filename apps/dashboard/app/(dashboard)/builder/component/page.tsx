import { PageHeader } from '@sparx/ui';
import { Component } from 'lucide-react';

// Placeholder. The catalog of data-aware (Tier 2) components merchants compose
// with, plus the authoring surface for defining new ones.
export default function BuilderComponentPage() {
  return (
    <div className="px-6 py-8 lg:px-10">
      <PageHeader
        icon={<Component className="h-5 w-5" />}
        title="Component"
        description="The catalog of data-aware components you compose pages from, and the surface for authoring new ones."
      />
      <div className="rounded-xl border border-dashed border-[var(--color-border-default)] p-12 text-center text-sm text-[var(--color-text-muted)]">
        Coming soon — the component catalog and authoring.
      </div>
    </div>
  );
}
