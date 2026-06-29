import { NewWorkflowForm } from './_components/new-workflow-form';

// New-workflow route. The embedded SurfaceFrame supplies its own title + window
// controls + pinned toolbar, so the page renders the form bare (no Container /
// PageHeader). The same form also renders in the drawer/modal overlay via
// `detail-slot.tsx`'s `createComponents['workflow']`, honoring the user's
// `defaultDetailView` preference.

export default function NewWorkflowPage() {
  return <NewWorkflowForm surface="page" />;
}
