import { NewPipelineForm } from './_components/new-pipeline-form';

// New-pipeline route. The embedded SurfaceFrame supplies its own title + window
// controls + pinned toolbar, so the page renders the form bare (no Container /
// PageHeader). The same form also renders in the drawer/modal overlay via
// `detail-slot.tsx`'s `createComponents['pipeline']`, honoring the user's
// `defaultDetailView` preference.

export default function NewPipelinePage() {
  return <NewPipelineForm surface="page" />;
}
