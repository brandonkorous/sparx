import { IssueGiftCardForm } from '../_components/issue-gift-card-form';

// Full-page surface for issuing a gift card. The surface-aware `IssueGiftCardForm`
// (docs/86 F layout) renders the SAME SurfaceFrame here (`surface="page"` → the
// `embedded` contained sheet, filling the dashboard content area with its own
// title + pinned toolbar) and inside the `@detail` drawer/modal overlay
// (`surface="overlay"`). This route is what `fullPage` / `newTab` detail-view
// preferences and deep links resolve to — no page-level Container/PageHeader, so
// the title isn't rendered twice. Gift cards have no detail view, so create stays
// open rather than flowing into a record.

export const dynamic = 'force-dynamic';

export default function NewGiftCardPage() {
  return <IssueGiftCardForm surface="page" />;
}
