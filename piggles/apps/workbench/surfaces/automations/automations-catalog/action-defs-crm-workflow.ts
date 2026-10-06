import { productCopy } from '../../../lib/product';
import { PRIORITY_OPTIONS } from './action-defs-crm';
import type { ActionDef } from './types';

export const CRM_WORKFLOW_ACTION_DEFS: readonly ActionDef[] = [
  // ── Workflow depth (docs/144 §9) ──
  {
    type: 'crm.create_record',
    label: 'Create a record',
    module: 'crm',
    description:
      'Add a new customer, a new sales deal, or a row of anything else you track. Whatever it creates gets linked to the record that started this rule, so you can find it later.',
    mode: 'fields',
    available: true,
    configFields: [
      {
        key: 'objectKey',
        label: 'What kind of record',
        type: 'text',
        required: true,
        placeholder: 'deal',
        help: 'Use “contact” for a person, “deal” for a sales opportunity, or the name of something you set up yourself.',
      },
      {
        key: 'title',
        label: 'Name it',
        type: 'text',
        placeholder: 'Renewal: {{customer.company}}',
        help: 'You can pull details in with {{ }}. They get filled in when the rule runs.',
      },
      {
        key: 'values',
        label: 'Fill in these details',
        type: 'json',
        help: 'Advanced: the fields to set, as JSON. For example {"value": 500}.',
      },
    ],
  },
  {
    type: 'crm.set_property',
    label: 'Set a detail on the record',
    module: 'crm',
    description:
      'Change one thing about whoever (or whatever) started this rule, including the details you set up yourself, like a renewal date or a warranty expiry.',
    mode: 'fields',
    available: true,
    configFields: [
      {
        key: 'target',
        label: 'On which record',
        type: 'select',
        options: [
          { value: 'contact', label: 'The customer' },
          { value: 'deal', label: 'The sales deal' },
          { value: 'record', label: 'The record' },
        ],
      },
      { key: 'property', label: 'Which detail', type: 'text', required: true },
      { key: 'value', label: 'Set it to', type: 'text', required: true },
      {
        key: 'custom',
        label: 'This is a detail I set up myself',
        type: 'select',
        options: [
          { value: 'true', label: 'Yes: one of my own' },
          { value: 'false', label: 'No: a built-in field' },
        ],
        help: productCopy(
          'automations.field.ownHint',
          'Leave as “one of my own” unless you are changing something Piggles ships with, like the lifecycle stage.'
        ),
      },
    ],
  },
  {
    type: 'crm.rotate_owner',
    label: 'Share it out among the team',
    module: 'crm',
    description:
      'Hand the record to whoever on your team currently has the least on. Leave the list blank to include everybody.',
    mode: 'fields',
    available: true,
    configFields: [
      {
        key: 'target',
        label: 'What to hand out',
        type: 'select',
        options: [
          { value: 'deal', label: 'The sales deal' },
          { value: 'contact', label: 'The customer' },
        ],
      },
      {
        key: 'userIds',
        label: 'Share between (team member IDs)',
        type: 'tags',
        help: 'Leave blank to share between everyone on your team.',
      },
    ],
  },
  {
    type: 'crm.add_to_list',
    label: 'Put them on a list',
    module: 'crm',
    description:
      'Add the customer to one of your hand-picked lists, or take them off it. Only works on hand-picked lists; a list that decides its own members from rules will not accept it.',
    mode: 'fields',
    available: true,
    configFields: [
      { key: 'segmentId', label: 'Which list', type: 'text', required: true },
      {
        key: 'remove',
        label: 'Add or remove',
        type: 'select',
        options: [
          { value: 'false', label: 'Put them on it' },
          { value: 'true', label: 'Take them off it' },
        ],
      },
    ],
  },
  {
    type: 'engagement.send_email',
    label: 'Write to them personally',
    module: 'crm',
    description:
      'Send one email to one person, threaded onto their conversation so it shows up on their timeline. Respects anyone who has asked not to be contacted. For emailing a whole audience, use a campaign instead.',
    mode: 'fields',
    available: true,
    configFields: [
      { key: 'subject', label: 'Subject', type: 'text', required: true },
      {
        key: 'bodyHtml',
        label: 'Message',
        type: 'textarea',
        required: true,
        help: 'You can pull in details with {{ }}, for example Hi {{customer.firstName}}.',
      },
    ],
  },
  {
    type: 'voice.log_call_task',
    label: 'Add a call-back to somebody’s list',
    module: 'crm',
    description:
      'Create a task to call the customer back, and note on their record why it came up. Does not place the call.',
    mode: 'fields',
    available: true,
    configFields: [
      { key: 'title', label: 'What to say it is', type: 'text', placeholder: 'Call them back' },
      { key: 'description', label: 'Notes', type: 'textarea' },
      {
        key: 'dueInDays',
        label: 'Due in (days)',
        type: 'number',
        placeholder: '0',
        help: '0 means today.',
      },
      { key: 'priority', label: 'Priority', type: 'select', options: PRIORITY_OPTIONS },
    ],
  },
  {
    type: 'crm.capture_lead',
    label: 'Save the form contact as a customer',
    module: 'crm',
    description:
      'Save whoever submitted a form as a customer and log their message, and, if the form is set to, open a sales deal. Follows the form’s own settings.',
    mode: 'none',
    available: true,
  },
];
