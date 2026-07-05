// form.submitted consumer (docs/115) — mirror a site-form lead into the CRM.
//
// gateHandler (ctx.gate) already enforces the `crm` module gate + at-least-once
// dedupe, so a submission on a CRM-less tenant is a no-op here (the row is still
// stored + emailed by api-rest; the CRM is purely additive). We additionally honor
// the form's own `addToCrm` toggle — a tenant may run CRM but not want every form
// feeding it.

import { captureFormLead } from '../services/lead-service';
import type { ConsumerContext } from './registry';

interface FormSubmittedPayload {
  submissionId: string;
  propertyId: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  message: string | null;
  addToCrm?: boolean;
}

export function registerFormEventConsumers(ctx: ConsumerContext): (() => void)[] {
  return [
    ctx.bus.subscribe(
      'form.submitted',
      ctx.gate(async (event) => {
        const p = event.payload as FormSubmittedPayload | null;
        if (!p?.addToCrm) return;
        await captureFormLead(
          { tenantId: event.tenantId },
          {
            submissionId: p.submissionId,
            propertyId: p.propertyId,
            name: p.name,
            email: p.email,
            phone: p.phone,
            message: p.message,
          }
        );
      })
    ),
  ];
}
