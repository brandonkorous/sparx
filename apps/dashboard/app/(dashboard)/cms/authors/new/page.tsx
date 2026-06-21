import { AuthorCreateForm } from '../author-create-form';

// Full-page surface for creating an author. The surface-aware `AuthorCreateForm`
// (docs/86 F layout) renders the SAME WizardFrame here (`surface="page"` → the
// `embedded` contained sheet, filling the dashboard content area with its own
// title + pinned toolbar) and inside the `@detail` drawer/modal overlay
// (`surface="overlay"`). This route is what `fullPage` / `newTab` detail-view
// preferences, deep links, and the overlay's "maximize" button resolve to — no
// page-level Container/PageHeader, so the title isn't rendered twice.
//
// (Historically /cms/authors/new fell through to the [id] segment, which treated
// "new" as a UUID and 500'd — audit F-04. This dedicated route fixes that.)

export const dynamic = 'force-dynamic';

export default function NewAuthorPage() {
  return <AuthorCreateForm surface="page" />;
}
