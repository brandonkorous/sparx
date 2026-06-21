import { AddSuppressionForm } from '../_components/add-suppression-form';

// Full-page surface for suppressing addresses. The surface-aware `AddSuppressionForm`
// (docs/86 F layout) renders the SAME WizardFrame here (`surface="page"` → the
// `embedded` contained sheet, filling the dashboard content area with its own
// title + pinned toolbar) and inside the `@detail` drawer/modal overlay
// (`surface="overlay"`). This route is what `fullPage` / `newTab` detail-view
// preferences and deep links resolve to — no page-level Container/PageHeader, so
// the title isn't rendered twice. Suppression has no detail view, so the form
// stays open and refreshes the list on success instead of navigating into a record.

export const dynamic = 'force-dynamic';

export default function NewSuppressionPage() {
  return <AddSuppressionForm surface="page" />;
}
