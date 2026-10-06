import type { ActionDef } from './types';

export const B2B_ACTION_DEFS: readonly ActionDef[] = [
  // ── Wholesale (B2B) ──
  {
    type: 'b2b.escalate_overdue',
    label: 'Chase an overdue wholesale account',
    module: 'b2b',
    description: 'Run the overdue-account ladder (credit hold, then suspend) on the account.',
    mode: 'fields',
    available: true,
    configFields: [
      {
        key: 'creditHoldDays',
        label: 'Credit hold after (days)',
        type: 'number',
        placeholder: '14',
      },
      { key: 'suspendDays', label: 'Suspend after (days)', type: 'number', placeholder: '30' },
    ],
  },
  {
    type: 'b2b.send_invoice',
    label: 'Email the invoice to the buyer',
    module: 'b2b',
    description:
      'Emails the invoice to the buyer, with their PO number and a link to print or save it. The same email as pressing Send on the invoice.',
    mode: 'none',
    available: true,
  },
  {
    type: 'b2b.ask_account_approvers',
    label: 'Ask the buyer’s approvers to sign off',
    module: 'b2b',
    description:
      'Emails everyone who can approve orders at the wholesale customer, except whoever placed it, with the order and a button to approve it or turn it down on your site.',
    mode: 'none',
    available: true,
  },
  {
    type: 'b2b.create_quote',
    label: 'Create a wholesale quote',
    module: 'b2b',
    description: 'Not available yet.',
    mode: 'json',
    available: false,
  },
  {
    type: 'b2b.convert_quote',
    label: 'Convert a wholesale quote',
    module: 'b2b',
    description: 'Not available yet.',
    mode: 'json',
    available: false,
  },
  {
    type: 'b2b.update_terms',
    label: 'Update wholesale terms',
    module: 'b2b',
    description: 'Not available yet.',
    mode: 'json',
    available: false,
  },
];
