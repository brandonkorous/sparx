// Site-forms system-automation seed (docs/115).
//
// The always-on default that turns every `form.submitted` into the response the
// tenant configured on the form itself: email me (+ any custom recipients), send the
// visitor a confirmation, and add them to the CRM. It carries all three actions
// UNCONDITIONALLY — each one self-gates on the form's own toggle (form.notify /
// form.autoresponder / form.addToCrm, resolved from the server-only FormDefinition),
// so the friendly per-form inspector stays the control surface while this automation
// is the mechanism. `crm.capture_lead` additionally rides the `crm` module gate, so
// on a CRM-less tenant that step is a recorded no-op and the two emails still send.
//
// module: null (always-on) — it isn't owned by a feature module because any tenant
// with a site can have a form. It installs on tenant provisioning + rides along with
// every module's seeding pass (seedSystemAutomations installs null-module seeds on
// any activation and on the daily reconcile), so every tenant gets it.

import type { SystemAutomationSpec } from '@sparx/automation';

export const FORM_HANDLE_SUBMISSIONS: SystemAutomationSpec = {
  name: 'Handle form submissions',
  description:
    'When someone submits a form on your site: emails you (and any custom recipients), sends the visitor a confirmation, adds them to your CRM, and — for quote/lead forms — opens a deal in your sales pipeline. Follows each form’s own settings. Edit or add steps to customize what happens.',
  trigger: { kind: 'event', eventType: 'form.submitted' },
  conditions: { logic: 'AND', conditions: [] },
  actions: [
    { type: 'form.notify', config: {} },
    { type: 'form.autoreply', config: {} },
    { type: 'crm.capture_lead', config: {} },
  ],
  locked: false,
  status: 'active',
};
