import { productCopy } from '../../../lib/product';
import type { ActionDef } from './types';

export const MESSAGE_ACTION_DEFS: readonly ActionDef[] = [
  // ── Site forms ──
  {
    type: 'form.notify',
    label: 'Email me the form reply',
    module: 'cms',
    description:
      'Email you (and any recipients set on the form) when it is submitted. Follows the form’s “email me” setting.',
    mode: 'none',
    available: true,
  },
  {
    type: 'form.autoreply',
    label: 'Send the visitor a confirmation',
    module: 'cms',
    description:
      'Send the person who submitted the form a confirmation reply. Follows the form’s “send a confirmation” setting.',
    mode: 'none',
    available: true,
  },
  // ── Email ──
  {
    type: 'email.send_campaign',
    label: 'Send a marketing email',
    module: 'email',
    description: 'Send the customer a designed email or coded template.',
    mode: 'json',
    available: true,
    jsonTemplate: { builderEmailId: '', subject: '' },
  },
  {
    type: 'email.send_internal',
    label: 'Email a note to staff',
    module: 'email',
    description: 'Email one of your own team members.',
    mode: 'fields',
    available: true,
    configFields: [
      { key: 'to', label: 'To', type: 'email', required: true },
      { key: 'subject', label: 'Subject', type: 'text', required: true },
      { key: 'text', label: 'Message', type: 'textarea', help: 'A plain-text and/or HTML body.' },
      { key: 'html', label: 'HTML body (optional)', type: 'textarea' },
    ],
  },
  {
    type: 'email.sequence_add',
    label: 'Add to an email sequence',
    module: 'email',
    description:
      'Start the customer on a multi-touch email sequence: a welcome series, a follow-up, a nurture. The sequence sends each email on its own schedule.',
    mode: 'fields',
    available: true,
    configFields: [
      {
        key: 'sequenceId',
        label: 'Which sequence',
        type: 'select',
        required: true,
        optionSource: 'email-sequences',
        help: 'Which sequence to start them on.',
        emptyHint: productCopy(
          'automations.sequence.none',
          'No sequences yet: create one under Email → Sequences.'
        ),
      },
    ],
  },
  {
    type: 'email.sequence_remove',
    label: 'Remove from an email sequence',
    module: 'email',
    description:
      'Take the customer out of an email sequence, so they stop getting the rest of its emails.',
    mode: 'fields',
    available: true,
    configFields: [
      {
        key: 'sequenceId',
        label: 'Which sequence',
        type: 'select',
        required: true,
        optionSource: 'email-sequences',
        help: 'Which sequence to take them out of.',
        emptyHint: productCopy(
          'automations.sequence.none',
          'No sequences yet: create one under Email → Sequences.'
        ),
      },
    ],
  },
];
