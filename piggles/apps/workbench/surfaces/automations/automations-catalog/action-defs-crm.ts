import type { ActionDef } from './types';

export const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
] as const;

export const CRM_ACTION_DEFS: readonly ActionDef[] = [
  // ── Customers (CRM) ──
  {
    type: 'crm.add_tag',
    label: 'Add a label to the customer',
    module: 'crm',
    description: 'Tag the customer this rule is about with one or more labels.',
    mode: 'fields',
    available: true,
    configFields: [
      { key: 'tags', label: 'Labels', type: 'tags', required: true, placeholder: 'vip, repeat' },
    ],
  },
  {
    type: 'crm.remove_tag',
    label: 'Remove a label from the customer',
    module: 'crm',
    description: 'Take one or more labels off the customer this rule is about.',
    mode: 'fields',
    available: true,
    configFields: [{ key: 'tags', label: 'Labels', type: 'tags', required: true }],
  },
  {
    type: 'crm.add_note',
    label: 'Add a note to the customer',
    module: 'crm',
    description: 'Record a note on the customer this rule is about.',
    mode: 'fields',
    available: true,
    configFields: [{ key: 'note', label: 'Note', type: 'textarea', required: true }],
  },
  {
    type: 'crm.update_field',
    label: 'Change a detail on the customer',
    module: 'crm',
    description: 'Set a single field on the customer this rule is about.',
    mode: 'fields',
    available: true,
    configFields: [
      { key: 'field', label: 'Which detail', type: 'text', required: true, placeholder: 'type' },
      {
        key: 'value',
        label: 'New value',
        type: 'json',
        required: true,
        help: 'The value to set, as JSON (e.g. "wholesale" or 5).',
      },
    ],
  },
  {
    type: 'crm.create_task',
    label: 'Create a task',
    module: 'crm',
    description: 'Open a follow-up task, linked to the customer or deal this rule is about.',
    mode: 'fields',
    available: true,
    configFields: [
      { key: 'title', label: 'Title', type: 'text', required: true },
      { key: 'description', label: 'Details', type: 'textarea' },
      { key: 'dueInDays', label: 'Due in (days)', type: 'number', placeholder: '3' },
      { key: 'priority', label: 'Priority', type: 'select', options: PRIORITY_OPTIONS },
      {
        key: 'assignedToUserId',
        label: 'Assign to (team member ID)',
        type: 'text',
        required: true,
        help: 'The ID of the team member who owns this task.',
      },
    ],
  },
  {
    type: 'crm.update_deal_stage',
    label: 'Move the sales deal',
    module: 'crm',
    description: 'Move the deal this rule is about to a step of its process.',
    mode: 'fields',
    available: true,
    configFields: [
      {
        key: 'toStageId',
        label: 'To stage (stage ID)',
        type: 'text',
        required: true,
        help: 'The short id of the step to move the deal into.',
      },
    ],
  },
  {
    type: 'crm.create_ticket',
    label: 'Open a support request',
    module: 'crm',
    description:
      'Turn whatever started this rule (a live chat, a form, an email someone sent you) into a support request in your queue, with a response time attached. Runs once per conversation, so a rule that fires twice will not open two requests.',
    mode: 'fields',
    available: true,
    configFields: [
      {
        key: 'subject',
        label: 'Subject',
        type: 'text',
        help: 'Leave blank and we will name it from where it came in: the form name, the email subject, or the customer’s name.',
      },
      {
        key: 'description',
        label: 'Details',
        type: 'textarea',
        help: 'Leave blank to use what they actually wrote.',
      },
      { key: 'priority', label: 'Priority', type: 'select', options: PRIORITY_OPTIONS },
      {
        key: 'assignedToUserId',
        label: 'Assign to (team member ID)',
        type: 'text',
        help: 'Leave blank to put it in the unassigned queue for whoever picks it up first.',
      },
    ],
  },
];
