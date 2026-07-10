import { InvoiceWizard } from './_components/invoice-wizard';
import { loadInvoiceWizardData } from './wizard-data';

// Full-page surface for creating a billing document. The in-app `embedded` top
// stepper (docs/86) composes the whole document — workflow + party, typed line
// items (priced live, incl. markup), tax/terms, an optional deposit, and the
// starting stage — then commits it on finish.
//
// On the Documents list the "New" affordance opens this same wizard inside the
// dashboard's drawer/modal detail chrome, picked by the user's `defaultDetailView`
// preference (the `'overlay'` presentation; see `EntityCreateButton` + the
// `@detail` create registry). This route is the full-page option that chrome's
// "open in full page" button, Shift-click, new-tab, and `?customerId=` /
// `?b2bAccountId=` / `?workflow=` deep links resolve to — e.g. B2B's "New
// Quote" button links here with `?workflow=b2b-quotes` to start on the system
// quotes workflow (the overlay create form has no such preselection — see the
// comment on `BillingDocumentCreateOverlay` in `detail-slot.tsx`).

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function NewDocumentPage({ searchParams }: PageProps) {
  const [sp, data] = await Promise.all([searchParams, loadInvoiceWizardData()]);
  const workflowSlug = stringParam(sp.workflow);
  const preselectedWorkflowId = workflowSlug
    ? (data.workflows.find((w) => w.slug === workflowSlug)?.id ?? null)
    : null;

  return (
    <InvoiceWizard
      {...data}
      preselectedCustomerId={stringParam(sp.customerId) ?? null}
      preselectedAccountId={stringParam(sp.b2bAccountId) ?? null}
      preselectedWorkflowId={preselectedWorkflowId}
    />
  );
}

function stringParam(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}
