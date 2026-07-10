import { requireSession } from '@sparx/auth';
import { CustomerFullProfileWizard } from './customer-full-profile-wizard';
import { loadPipelineOptions } from './pipeline-options';
import { loadQuoteWorkflowId } from './quote-workflow-option';

// Full-page surface for creating a customer. The in-app `embedded` top stepper
// (docs/86) fills the dashboard content area (sidebar + header stay). On the CRM
// list the "New" affordance opens this
// same wizard inside the dashboard's drawer/modal detail chrome, picked by the
// user's `defaultDetailView` preference (the `overlay` presentation). This route
// is the full-page option that "open in full page", Shift-click, new-tab, and
// deep links resolve to. The current user id powers the optional follow-up task;
// the pipelines power the optional deal in the Opportunity step.

export default async function NewCustomerPage() {
  const [session, pipelines, quoteWorkflowId] = await Promise.all([
    requireSession(),
    loadPipelineOptions(),
    loadQuoteWorkflowId(),
  ]);
  return (
    <CustomerFullProfileWizard
      presentation="page"
      currentUserId={session.user.id}
      pipelines={pipelines}
      quoteWorkflowId={quoteWorkflowId}
    />
  );
}
