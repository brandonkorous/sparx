import { RedirectCreateForm } from '../_components/redirect-create-form';

// Full-page surface for creating a redirect. The surface-aware `RedirectCreateForm`
// (docs/86 F layout) renders the SAME WizardFrame here (`surface="page"` → the
// `embedded` contained sheet, filling the dashboard content area with its own
// title + pinned toolbar) and inside the `@detail` drawer/modal overlay
// (`surface="overlay"`). This route is what `fullPage` / `newTab` detail-view
// preferences and deep links resolve to — no page-level Container/PageHeader, so
// the title isn't rendered twice. Redirects have no detail view, so the form
// stays open on success rather than flowing into a record.

export const dynamic = 'force-dynamic';

export default function NewRedirectPage() {
  return <RedirectCreateForm surface="page" />;
}
