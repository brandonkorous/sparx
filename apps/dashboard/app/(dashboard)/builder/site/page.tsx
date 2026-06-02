import { PageHeader } from '@sparx/ui';
import { Globe } from 'lucide-react';

// Placeholder. The whole site as one tree — shared layouts and the chrome zones
// (header / footer / sidebar) plus navigation that wrap every page.
export default function BuilderSitePage() {
  return (
    <div className="px-6 py-8 lg:px-10">
      <PageHeader
        icon={<Globe className="h-5 w-5" />}
        title="Site"
        description="The whole site as one tree — shared layouts, the chrome zones (header, footer, sidebar), and navigation that wrap every page."
      />
      <div className="rounded-xl border border-dashed border-[var(--color-border-default)] p-12 text-center text-sm text-[var(--color-text-muted)]">
        Coming soon — site-level layouts and zones.
      </div>
    </div>
  );
}
