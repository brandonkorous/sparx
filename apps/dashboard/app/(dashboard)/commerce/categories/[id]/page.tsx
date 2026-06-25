import { UnsavedGuardProvider } from '../../../_components/unsaved-guard';

import { CategoryDetailContent } from './_content';

// Full-page surface for a category's detail/edit view. The body lives in the
// surface-agnostic `CategoryDetailContent`, which renders the SAME SurfaceFrame
// here (`surface="page"` → the `embedded` contained sheet, filling the dashboard
// content area with its own title + pinned toolbar) and inside the `@detail`
// drawer/modal overlay (`surface="overlay"`). This route is what `fullPage` /
// `newTab` detail-view preferences, deep links, and the overlay's "maximize"
// button resolve to — no page-level Container/PageHeader, so the title isn't
// rendered twice.
//
// Wrapped in the unsaved-guard provider so the in-title-strip presentation switch
// (open-as-drawer/modal) confirms before discarding edits, exactly as the overlay
// host's chrome does — the form registers its dirty-guard into this provider.

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CategoryDetailPage({ params }: PageProps) {
  const { id } = await params;
  return (
    <UnsavedGuardProvider>
      <CategoryDetailContent id={id} surface="page" />
    </UnsavedGuardProvider>
  );
}
