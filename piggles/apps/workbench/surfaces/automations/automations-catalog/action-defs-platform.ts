import type { ActionDef } from './types';

const HTTP_METHODS = [
  { value: 'POST', label: 'POST' },
  { value: 'GET', label: 'GET' },
  { value: 'PUT', label: 'PUT' },
  { value: 'PATCH', label: 'PATCH' },
  { value: 'DELETE', label: 'DELETE' },
] as const;

export const PLATFORM_ACTION_DEFS: readonly ActionDef[] = [
  // ── Control flow ──
  {
    type: 'platform.wait',
    label: 'Wait a while',
    module: 'platform',
    description: 'Pause before the next step, for example, wait a day before following up.',
    mode: 'fields',
    available: true,
    configFields: [
      {
        key: 'delaySeconds',
        label: 'Wait for (seconds)',
        type: 'number',
        required: true,
        placeholder: '86400',
        help: 'How long to pause. 3600 is an hour, 86400 is a day.',
      },
    ],
  },
  {
    type: 'platform.stop',
    label: 'Stop here',
    module: 'platform',
    description: 'End the automation early and note why.',
    mode: 'fields',
    available: true,
    configFields: [
      { key: 'reason', label: 'Reason', type: 'text', placeholder: 'No longer needed' },
    ],
  },
  {
    type: 'platform.if_else',
    label: 'Go one way or the other',
    module: 'platform',
    description:
      'Ask a question about the record, then do one set of things if the answer is yes and another if it is no. Either side can be left empty.',
    // `branch` rather than `fields`: its config holds two whole lists of steps,
    // which is not something a key/value form can express. The editor renders a
    // nested canvas for it (see flow-canvas).
    mode: 'branch',
    available: true,
  },
  {
    type: 'platform.webhook',
    label: 'Send data to another system',
    module: 'platform',
    description: 'POST the details to an outside web address (a webhook).',
    mode: 'fields',
    available: true,
    configFields: [
      {
        key: 'url',
        label: 'Web address',
        type: 'text',
        required: true,
        placeholder: 'https://example.com/hook',
      },
      { key: 'method', label: 'Method', type: 'select', options: HTTP_METHODS },
      {
        key: 'headers',
        label: 'Extra headers',
        type: 'json',
        help: 'Advanced: extra header lines to send, written as JSON. For example {"X-Token": "abc123"}.',
      },
      {
        key: 'payload',
        label: 'Extra data',
        type: 'json',
        help: 'Advanced: any extra details to send along, written as JSON. For example {"source": "piggles"}.',
      },
    ],
  },
  {
    type: 'platform.notify',
    label: 'Notify the team in-app',
    module: 'platform',
    description: 'Post a notification your team sees inside the workbench.',
    mode: 'fields',
    available: true,
    configFields: [
      { key: 'title', label: 'Heading', type: 'text', required: true },
      { key: 'body', label: 'Message', type: 'textarea' },
    ],
  },
];
