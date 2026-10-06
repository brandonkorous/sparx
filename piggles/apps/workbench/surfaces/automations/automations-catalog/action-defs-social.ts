import type { ActionDef } from './types';

export const SOCIAL_ACTION_DEFS: readonly ActionDef[] = [
  // ── Social posts ──
  {
    type: 'social.post',
    label: 'Post to social media',
    module: 'social',
    description:
      'Drafts a post to your connected social accounts. By default it lands in your Approvals inbox to review first; you can also set it to post automatically.',
    mode: 'fields',
    available: true,
    configFields: [
      {
        key: 'template',
        label: 'Message',
        type: 'textarea',
        required: true,
        placeholder: 'New arrival: {{announce.title}}',
        help: 'The post text. Use {{announce.title}} for the product or article name; the link and image are attached for you.',
      },
      {
        key: 'targetIds',
        label: 'Which accounts',
        type: 'multiselect',
        optionSource: 'social-targets',
        help: 'Leave everything unticked to post to all your connected accounts. Tick some to narrow this automation to just those.',
        emptyHint:
          'No connected accounts yet. Connect one under Social → Connections and they will appear here.',
      },
      {
        key: 'autoApprove',
        label: 'Before it goes out',
        type: 'select',
        options: [
          { value: '', label: 'Send to my Approvals inbox to review first' },
          { value: 'auto', label: 'Post automatically, no review' },
        ],
        help: 'Reviewing first is recommended until you trust the drafts.',
      },
    ],
  },
];
