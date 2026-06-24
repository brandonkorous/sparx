import { AddDomainForm } from '../_components/add-domain-form';

// Full-page surface for adding a sending domain. The surface-aware `AddDomainForm`
// (docs/86 F layout) renders the SAME SurfaceFrame here (`surface="page"` → the
// `embedded` contained sheet, filling the dashboard content area with its own
// title + pinned toolbar) and inside the `@detail` drawer/modal overlay
// (`surface="overlay"`). Sending domains have no detail view, so this is purely
// the create surface — no page-level Container/PageHeader, so the title isn't
// rendered twice.

export const dynamic = 'force-dynamic';

export default function NewSendingDomainPage() {
  return <AddDomainForm surface="page" />;
}
