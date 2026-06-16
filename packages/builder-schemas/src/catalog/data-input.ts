// Catalog · Data input (docs/98 §5). Fields, choices, toggles, and real forms.
//
// Inputs are PRESENTATIONAL here — there is no behavior runtime, so nothing has an
// onChange and nothing carries a bare `value` (the sanitizer drops it). A field is
// a composed node tree: a <label> wrapping its control (the only reliable way to
// associate them — `for`/`htmlFor` isn't whitelisted), plus help text. Focus state
// rides `focus-within:` on the wrapper so the whole field lights up. Real forms
// (`contact_form`, `login_form`) are honest <form>s that collapse to one column on
// narrow containers via container queries — never viewport breakpoints.

import { el, atom, entry, type PlatformCatalogEntry } from './_kit';

// The shared field shell: rounded, bordered, focus ring via focus-within on the
// wrapper so the control's own focus outline can stay suppressed.
const FIELD_SHELL =
  'flex w-full items-center rounded-field border border-base-300 bg-base-100 px-3 py-2 transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/30';

// The bare control inside a shell — strips the native chrome so the shell owns it.
const CONTROL =
  'w-full bg-transparent text-sm text-base-content outline-none placeholder:text-base-content/40';

// A field shell wrapping one or more controls (the focus ring lives on this <div>).
const shell = (children: ReturnType<typeof el>[]) => el('div', FIELD_SHELL, { children });

// A label caption sitting above its control.
const fieldLabel = (text: string) => el('span', 'text-sm font-medium text-base-content', { text });

// Small help / hint text under a field.
const helpText = (text: string) => el('span', 'text-xs text-base-content/60', { text });

// One checkbox or radio row: the input + its caption, wrapped in a <label> so the
// caption is the hit target without a `for` attribute. (No `checked` — it isn't a
// whitelisted input attr and these are presentational.)
const choiceRow = (control: 'checkbox' | 'radio', caption: string, name: string) =>
  el(
    'label',
    'flex cursor-pointer items-center gap-3 rounded-field px-2 py-1.5 hover:bg-base-200',
    {
      children: [
        el(
          'input',
          control === 'checkbox'
            ? 'h-4 w-4 shrink-0 rounded-selector border-base-300 text-primary accent-primary'
            : 'h-4 w-4 shrink-0 border-base-300 text-primary accent-primary',
          { attrs: { type: control, name } }
        ),
        el('span', 'text-sm text-base-content', { text: caption }),
      ],
    }
  );

export const DATA_INPUT_CATALOG: PlatformCatalogEntry[] = [
  // ── Text field — label + text input + help ───────────────────────────────────
  entry({
    key: 'text_field',
    name: 'Text field',
    category: 'data-input',
    kind: 'common',
    icon: 'text-cursor-input',
    description:
      'A labeled single-line text input with help text and a focus ring on the whole field.',
    surfaces: ['page', 'site'],
    tags: ['input', 'text', 'field', 'form', 'label'],
    tree: el('label', 'flex w-full max-w-sm flex-col gap-1.5', {
      children: [
        fieldLabel('Full name'),
        shell([
          el('input', CONTROL, {
            attrs: { type: 'text', name: 'full_name', placeholder: 'Jordan Avery' },
          }),
        ]),
        helpText('As it should appear on your account.'),
      ],
    }),
  }),

  // ── Email field — label + email input ────────────────────────────────────────
  entry({
    key: 'email_field',
    name: 'Email field',
    category: 'data-input',
    kind: 'common',
    icon: 'mail',
    description: 'A labeled email input with a placeholder, ready for sign-up and contact flows.',
    surfaces: ['page', 'site'],
    tags: ['input', 'email', 'field', 'form'],
    tree: el('label', 'flex w-full max-w-sm flex-col gap-1.5', {
      children: [
        fieldLabel('Email address'),
        shell([
          el('input', CONTROL, {
            attrs: { type: 'email', name: 'email', placeholder: 'you@example.com' },
          }),
        ]),
        helpText("We'll only use this to reply — never shared."),
      ],
    }),
  }),

  // ── Textarea field — multi-line ──────────────────────────────────────────────
  entry({
    key: 'textarea_field',
    name: 'Textarea',
    category: 'data-input',
    kind: 'common',
    icon: 'pilcrow',
    description: 'A labeled multi-line text area for longer messages and notes.',
    surfaces: ['page', 'site'],
    tags: ['input', 'textarea', 'multiline', 'field', 'form', 'message'],
    tree: el('label', 'flex w-full max-w-md flex-col gap-1.5', {
      children: [
        fieldLabel('Your message'),
        el(
          'div',
          'rounded-field border border-base-300 bg-base-100 px-3 py-2 transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/30',
          {
            children: [
              el('textarea', `${CONTROL} min-h-28 resize-y leading-relaxed`, {
                attrs: { name: 'message', placeholder: 'Tell us how we can help…' },
              }),
            ],
          }
        ),
        helpText('A few sentences is plenty.'),
      ],
    }),
  }),

  // ── Select field — native select ─────────────────────────────────────────────
  entry({
    key: 'select_field',
    name: 'Select',
    category: 'data-input',
    kind: 'common',
    icon: 'chevron-down',
    description: 'A labeled native dropdown for choosing one option from a list.',
    surfaces: ['page', 'site'],
    tags: ['input', 'select', 'dropdown', 'field', 'form', 'option'],
    tree: el('label', 'flex w-full max-w-sm flex-col gap-1.5', {
      children: [
        fieldLabel('Department'),
        shell([
          el('select', `${CONTROL} cursor-pointer`, {
            attrs: { name: 'department' },
            children: [
              el('option', '', { text: 'Sales' }),
              el('option', '', { text: 'Support' }),
              el('option', '', { text: 'Billing' }),
              el('option', '', { text: 'Partnerships' }),
            ],
          }),
        ]),
      ],
    }),
  }),

  // ── Checkbox list — fieldset + rows ──────────────────────────────────────────
  entry({
    key: 'checkbox_list',
    name: 'Checkbox list',
    category: 'data-input',
    kind: 'common',
    icon: 'list-checks',
    description: 'A grouped set of checkboxes under a legend for selecting multiple options.',
    surfaces: ['page', 'site'],
    tags: ['input', 'checkbox', 'list', 'multi-select', 'fieldset', 'form'],
    tree: el(
      'fieldset',
      'flex w-full max-w-sm flex-col gap-1 rounded-box border border-base-200 p-4',
      {
        children: [
          el('legend', 'px-1 text-sm font-medium text-base-content', {
            text: 'Keep me posted about',
          }),
          choiceRow('checkbox', 'Product updates', 'topics'),
          choiceRow('checkbox', 'New guides and tips', 'topics'),
          choiceRow('checkbox', 'Offers and promotions', 'topics'),
        ],
      }
    ),
  }),

  // ── Radio group — fieldset + rows ────────────────────────────────────────────
  entry({
    key: 'radio_group',
    name: 'Radio group',
    category: 'data-input',
    kind: 'common',
    icon: 'circle-dot',
    description: 'A grouped set of radio buttons under a legend for choosing exactly one option.',
    surfaces: ['page', 'site'],
    tags: ['input', 'radio', 'group', 'choice', 'fieldset', 'form'],
    tree: el(
      'fieldset',
      'flex w-full max-w-sm flex-col gap-1 rounded-box border border-base-200 p-4',
      {
        children: [
          el('legend', 'px-1 text-sm font-medium text-base-content', {
            text: 'Preferred contact method',
          }),
          choiceRow('radio', 'Email', 'contact_method'),
          choiceRow('radio', 'Phone call', 'contact_method'),
          choiceRow('radio', 'Text message', 'contact_method'),
        ],
      }
    ),
  }),

  // ── Toggle switch — peer checkbox styled as an iOS switch ─────────────────────
  entry({
    key: 'toggle_switch',
    name: 'Toggle switch',
    category: 'data-input',
    kind: 'common',
    icon: 'toggle-right',
    description: 'A switch-style checkbox where the track and thumb animate with peer-checked.',
    surfaces: ['page', 'site'],
    tags: ['input', 'toggle', 'switch', 'checkbox', 'boolean', 'form'],
    tree: el('label', 'flex w-full max-w-sm cursor-pointer items-center justify-between gap-4', {
      children: [
        el('span', 'flex flex-col', {
          children: [
            el('span', 'text-sm font-medium text-base-content', { text: 'Email notifications' }),
            el('span', 'text-xs text-base-content/60', {
              text: 'Receive an email when something needs you.',
            }),
          ],
        }),
        // The switch: a peer checkbox + a track whose thumb slides on peer-checked.
        el('span', 'relative inline-flex shrink-0', {
          children: [
            el('input', 'peer sr-only', { attrs: { type: 'checkbox', name: 'notifications' } }),
            el(
              'span',
              'block h-6 w-11 rounded-full bg-base-300 transition-colors peer-checked:bg-primary',
              {}
            ),
            el(
              'span',
              'absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-base-100 shadow-sm transition-transform peer-checked:translate-x-5',
              {}
            ),
          ],
        }),
      ],
    }),
  }),

  // ── Range slider — label + range + value hint ────────────────────────────────
  entry({
    key: 'range_slider',
    name: 'Range slider',
    category: 'data-input',
    kind: 'common',
    icon: 'sliders-horizontal',
    description: 'A labeled range input with a live value hint for picking a number on a scale.',
    surfaces: ['page', 'site'],
    tags: ['input', 'range', 'slider', 'number', 'field', 'form'],
    tree: el('label', 'flex w-full max-w-sm flex-col gap-2', {
      children: [
        el('span', 'flex items-center justify-between', {
          children: [
            el('span', 'text-sm font-medium text-base-content', { text: 'Budget' }),
            el(
              'span',
              'rounded-selector bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary',
              {
                text: '$2,500',
              }
            ),
          ],
        }),
        el(
          'input',
          'h-2 w-full cursor-pointer appearance-none rounded-full bg-base-300 accent-primary',
          {
            attrs: { type: 'range', name: 'budget' },
          }
        ),
        el('span', 'flex items-center justify-between text-xs text-base-content/50', {
          children: [el('span', '', { text: '$0' }), el('span', '', { text: '$10,000' })],
        }),
      ],
    }),
  }),

  // ── Search bar — leading icon + input + submit, joined ───────────────────────
  entry({
    key: 'search_bar',
    name: 'Search bar',
    category: 'data-input',
    kind: 'common',
    icon: 'search',
    description: 'A search input with a leading icon joined to a primary submit button.',
    surfaces: ['page', 'site'],
    tags: ['input', 'search', 'find', 'query', 'form', 'submit'],
    tree: el('form', 'flex w-full max-w-md items-stretch', {
      attrs: { role: 'search', ariaLabel: 'Site search' },
      children: [
        el(
          'div',
          'flex flex-1 items-center gap-2 rounded-l-field border border-r-0 border-base-300 bg-base-100 px-3 transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/30',
          {
            children: [
              atom('Icon', 'h-4 w-4 shrink-0 text-base-content/40', { name: 'search' }),
              el('input', `${CONTROL} py-2.5`, {
                attrs: {
                  type: 'search',
                  name: 'q',
                  placeholder: 'Search products, articles, and help…',
                },
              }),
            ],
          }
        ),
        atom('Button', 'st-btn st-c-primary st-v-solid st-btn--sz-md rounded-l-none', {
          label: 'Search',
        }),
      ],
    }),
  }),

  // ── Contact form — real form, two-column on wide ─────────────────────────────
  entry({
    key: 'contact_form',
    name: 'Contact form',
    category: 'data-input',
    kind: 'comprehensive',
    icon: 'send',
    description:
      'A complete contact form with name, email, and message that stacks on narrow containers.',
    surfaces: ['page', 'site'],
    tags: ['form', 'contact', 'email', 'message', 'lead', 'inquiry'],
    tree: el(
      'form',
      'flex w-full max-w-2xl flex-col gap-5 rounded-box border border-base-200 bg-base-100 p-6 shadow-sm @container',
      {
        children: [
          el('div', 'flex flex-col gap-1', {
            children: [
              atom('Heading', 'text-lg font-semibold text-base-content', {
                level: 'h3',
                text: 'Get in touch',
              }),
              el('p', 'text-sm text-base-content/60', {
                text: "Send us a note and we'll reply within one business day.",
              }),
            ],
          }),
          // Name + email side by side on wide containers, stacked on narrow.
          el('div', 'grid grid-cols-1 gap-4 @3xl:grid-cols-2', {
            children: [
              el('label', 'flex flex-col gap-1.5', {
                children: [
                  fieldLabel('Name'),
                  shell([
                    el('input', CONTROL, {
                      attrs: {
                        type: 'text',
                        name: 'name',
                        placeholder: 'Jordan Avery',
                        required: true,
                      },
                    }),
                  ]),
                ],
              }),
              el('label', 'flex flex-col gap-1.5', {
                children: [
                  fieldLabel('Email'),
                  shell([
                    el('input', CONTROL, {
                      attrs: {
                        type: 'email',
                        name: 'email',
                        placeholder: 'you@example.com',
                        required: true,
                      },
                    }),
                  ]),
                ],
              }),
            ],
          }),
          el('label', 'flex flex-col gap-1.5', {
            children: [
              fieldLabel('Message'),
              el(
                'div',
                'rounded-field border border-base-300 bg-base-100 px-3 py-2 transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/30',
                {
                  children: [
                    el('textarea', `${CONTROL} min-h-28 resize-y leading-relaxed`, {
                      attrs: { name: 'message', placeholder: 'How can we help?' },
                    }),
                  ],
                }
              ),
            ],
          }),
          el('div', 'flex items-center justify-end', {
            children: [
              atom('Button', 'st-btn st-c-primary st-v-solid st-btn--sz-md', {
                label: 'Send message',
              }),
            ],
          }),
        ],
      }
    ),
  }),

  // ── Login form — card form ───────────────────────────────────────────────────
  entry({
    key: 'login_form',
    name: 'Login form',
    category: 'data-input',
    kind: 'comprehensive',
    icon: 'log-in',
    description:
      'A centered sign-in card with email, password, a submit button, and a forgot-password link.',
    surfaces: ['page', 'site'],
    tags: ['form', 'login', 'sign-in', 'auth', 'password', 'account'],
    tree: el(
      'form',
      'flex w-full max-w-sm flex-col gap-5 rounded-box border border-base-200 bg-base-100 p-7 shadow-md',
      {
        children: [
          el('div', 'flex flex-col gap-1 text-center', {
            children: [
              atom('Heading', 'text-xl font-semibold text-base-content', {
                level: 'h2',
                text: 'Welcome back',
              }),
              el('p', 'text-sm text-base-content/60', { text: 'Sign in to manage your account.' }),
            ],
          }),
          el('label', 'flex flex-col gap-1.5', {
            children: [
              fieldLabel('Email'),
              shell([
                el('input', CONTROL, {
                  attrs: {
                    type: 'email',
                    name: 'email',
                    placeholder: 'you@example.com',
                    required: true,
                  },
                }),
              ]),
            ],
          }),
          el('label', 'flex flex-col gap-1.5', {
            children: [
              el('span', 'flex items-center justify-between', {
                children: [
                  el('span', 'text-sm font-medium text-base-content', { text: 'Password' }),
                  el('a', 'text-xs font-medium text-primary transition-colors hover:underline', {
                    text: 'Forgot?',
                    attrs: { href: '/forgot-password' },
                  }),
                ],
              }),
              shell([
                el('input', CONTROL, {
                  attrs: {
                    type: 'password',
                    name: 'password',
                    placeholder: '••••••••',
                    required: true,
                  },
                }),
              ]),
            ],
          }),
          atom('Button', 'st-btn st-c-primary st-v-solid st-btn--sz-md w-full', {
            label: 'Sign in',
          }),
          el('p', 'text-center text-sm text-base-content/60', {
            children: [
              el('span', '', { text: "Don't have an account? " }),
              el('a', 'font-medium text-primary transition-colors hover:underline', {
                text: 'Create one',
                attrs: { href: '/signup' },
              }),
            ],
          }),
        ],
      }
    ),
  }),

  // ── File upload — dashed dropzone wrapping a file input ───────────────────────
  entry({
    key: 'file_upload',
    name: 'File upload',
    category: 'data-input',
    kind: 'common',
    icon: 'upload-cloud',
    description: 'A dashed dropzone wrapping a native file input for picking documents or images.',
    surfaces: ['page', 'site'],
    tags: ['input', 'file', 'upload', 'dropzone', 'attachment', 'form'],
    tree: el(
      'label',
      'flex w-full max-w-md cursor-pointer flex-col items-center gap-2 rounded-box border-2 border-dashed border-base-300 bg-base-200/40 px-6 py-10 text-center transition-colors hover:border-primary hover:bg-primary/5',
      {
        children: [
          el(
            'span',
            'flex h-12 w-12 items-center justify-center rounded-full bg-base-100 text-base-content/60 shadow-sm',
            {
              children: [atom('Icon', 'h-5 w-5', { name: 'upload-cloud' })],
            }
          ),
          el('span', 'flex flex-col gap-0.5', {
            children: [
              el('span', 'text-sm font-medium text-base-content', {
                text: 'Click to upload or drag and drop',
              }),
              el('span', 'text-xs text-base-content/50', { text: 'PNG, JPG, or PDF up to 10 MB' }),
            ],
          }),
          el('input', 'sr-only', { attrs: { type: 'file', name: 'attachment' } }),
        ],
      }
    ),
  }),
];
