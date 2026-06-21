import { QuoteWizard } from './_components/quote-wizard';
import { loadQuoteWizardData } from './wizard-data';

// Full-page surface for creating a quote. The in-app `embedded` top stepper
// (docs/86) composes the whole draft — party + currency, priced line items,
// shipping/terms/notes — then commits it on finish.
//
// On the Quotes list the "New" affordance opens this same wizard inside the
// dashboard's drawer/modal detail chrome, picked by the user's `defaultDetailView`
// preference (the `'overlay'` presentation; see `EntityCreateButton` + the
// `@detail` create registry). This route is the full-page option that chrome's
// "open in full page" button, Shift-click, new-tab, and `?customerId=` deep links
// resolve to.

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function NewQuotePage({ searchParams }: PageProps) {
  const [sp, data] = await Promise.all([searchParams, loadQuoteWizardData()]);

  return <QuoteWizard {...data} preselectedCustomerId={stringParam(sp.customerId) ?? null} />;
}

function stringParam(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}
