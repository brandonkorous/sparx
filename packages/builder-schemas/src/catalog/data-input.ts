// Catalog · Data input (docs/98 §5). Fields, choices, toggles, and real forms.
//
// Inputs compose the REAL site-ui form atoms now that the registry exposes them
// (Layer 1, docs/102): the Field atom (st-field) wraps a label + control + hint, and
// the Input / Textarea / Select / Checkbox / Radio / Switch / Range atoms carry the
// recipe on node.class (st-c-*/st-fv-*), so focus color and emphasis are driven from
// the inspector rather than baked into a hand-rolled shell. Inputs stay
// presentational — no behavior runtime, nothing carries a bare `value`. The two
// bespoke layouts with no single atom (the joined search bar, the dashed file
// dropzone) stay utility compositions.

import { el, atom, entry, type PlatformCatalogEntry } from './_kit';
import { DEFAULT_CONTACT_FORM_PROPS } from '../forms';

type Node = ReturnType<typeof atom>;

// A bare text-style input atom (st-input) carrying the field recipe.
const input = (type: string, name: string, placeholder: string): Node =>
  atom('Input', 'st-c-primary st-fv-outline', { type, name, placeholder });

// A labeled field: the Field atom (st-field) wraps the control with its label + hint.
const field = (
  label: string,
  control: Node,
  opts: { hint?: string; required?: boolean; cls?: string } = {}
): Node =>
  atom(
    'Field',
    opts.cls ?? 'w-full max-w-sm',
    {
      label,
      ...(opts.hint ? { hint: opts.hint } : {}),
      ...(opts.required ? { required: true } : {}),
    },
    [control]
  );

// One checkbox / radio row: the real atom + its caption, wrapped in a <label> so the
// caption is the hit target without a `for` attribute.
const choiceRow = (control: 'Checkbox' | 'Radio', caption: string, name: string): Node =>
  el(
    'label',
    'flex cursor-pointer items-center gap-3 rounded-field px-2 py-1.5 hover:bg-base-200',
    {
      children: [
        atom(control, 'st-c-primary', { name }),
        el('span', 'text-sm text-base-content', { text: caption }),
      ],
    }
  );

// The bare control inside the bespoke search join — chromeless, blends into the join.
const SEARCH_CONTROL =
  'w-full bg-transparent text-sm text-base-content outline-none placeholder:text-base-content/40';

export const DATA_INPUT_CATALOG: PlatformCatalogEntry[] = [
  // ── Text field — Field + Input atom ──────────────────────────────────────────
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
    tree: field('Full name', input('text', 'full_name', 'Jordan Avery'), {
      hint: 'As it should appear on your account.',
    }),
  }),

  // ── Email field ──────────────────────────────────────────────────────────────
  entry({
    key: 'email_field',
    name: 'Email field',
    category: 'data-input',
    kind: 'common',
    icon: 'mail',
    description: 'A labeled email input with a placeholder, ready for sign-up and contact flows.',
    surfaces: ['page', 'site'],
    tags: ['input', 'email', 'field', 'form'],
    tree: field('Email address', input('email', 'email', 'you@example.com'), {
      hint: "We'll only use this to reply — never shared.",
    }),
  }),

  // ── Textarea field ───────────────────────────────────────────────────────────
  entry({
    key: 'textarea_field',
    name: 'Textarea',
    category: 'data-input',
    kind: 'common',
    icon: 'pilcrow',
    description: 'A labeled multi-line text area for longer messages and notes.',
    surfaces: ['page', 'site'],
    tags: ['input', 'textarea', 'multiline', 'field', 'form', 'message'],
    tree: field(
      'Your message',
      atom('Textarea', 'st-c-primary st-fv-outline', {
        name: 'message',
        placeholder: 'Tell us how we can help…',
        rows: '4',
      }),
      { hint: 'A few sentences is plenty.', cls: 'w-full max-w-md' }
    ),
  }),

  // ── Select field ─────────────────────────────────────────────────────────────
  entry({
    key: 'select_field',
    name: 'Select',
    category: 'data-input',
    kind: 'common',
    icon: 'chevron-down',
    description: 'A labeled native dropdown for choosing one option from a list.',
    surfaces: ['page', 'site'],
    tags: ['input', 'select', 'dropdown', 'field', 'form', 'option'],
    tree: field(
      'Department',
      atom('Select', 'st-c-primary st-fv-outline', {
        name: 'department',
        options: 'Sales\nSupport\nBilling\nPartnerships',
      })
    ),
  }),

  // ── Checkbox list — fieldset + Checkbox atoms ────────────────────────────────
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
          choiceRow('Checkbox', 'Product updates', 'topics'),
          choiceRow('Checkbox', 'New guides and tips', 'topics'),
          choiceRow('Checkbox', 'Offers and promotions', 'topics'),
        ],
      }
    ),
  }),

  // ── Radio group — fieldset + Radio atoms ─────────────────────────────────────
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
          choiceRow('Radio', 'Email', 'contact_method'),
          choiceRow('Radio', 'Phone call', 'contact_method'),
          choiceRow('Radio', 'Text message', 'contact_method'),
        ],
      }
    ),
  }),

  // ── Toggle switch — the Switch atom (st-switch) ──────────────────────────────
  entry({
    key: 'toggle_switch',
    name: 'Toggle switch',
    category: 'data-input',
    kind: 'common',
    icon: 'toggle-right',
    description: 'A switch-style control beside a label and description.',
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
        atom('Switch', 'st-c-primary', { name: 'notifications' }),
      ],
    }),
  }),

  // ── Range slider — the Range atom (st-range) ─────────────────────────────────
  entry({
    key: 'range_slider',
    name: 'Range slider',
    category: 'data-input',
    kind: 'common',
    icon: 'sliders-horizontal',
    description: 'A labeled range input with a value hint for picking a number on a scale.',
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
              { text: '$2,500' }
            ),
          ],
        }),
        atom('Range', 'st-c-primary w-full', { name: 'budget', min: '0', max: '10000' }),
        el('span', 'flex items-center justify-between text-xs text-base-content/50', {
          children: [el('span', '', { text: '$0' }), el('span', '', { text: '$10,000' })],
        }),
      ],
    }),
  }),

  // ── Search bar — bespoke join (leading icon + input + submit) ────────────────
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
              el('input', `${SEARCH_CONTROL} py-2.5`, {
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

  // ── Contact form — a WIRED lead-capture block (docs/115) ─────────────────────
  // The interactive `ContactForm` block is a real <form> that WRAPS its children:
  // the fields below are ordinary named input atoms, so the author edits, restyles,
  // reorders, adds, or removes them with the normal builder — this is just a
  // pre-filled starting point. On the live site it POSTs its named controls to the
  // public submit endpoint; the seeded automation then stores the lead, emails the
  // owner, optionally auto-replies, and adds the person to the CRM. Routing is
  // configured in the inspector; recipient addresses are kept server-side (never
  // shipped in the published tree). The block renders its own submit button.
  entry({
    key: 'contact_form',
    name: 'Contact form',
    category: 'data-input',
    kind: 'comprehensive',
    icon: 'send',
    description:
      'A working form — collects whatever fields you put in it, emails you, and can add the person to your CRM. Add, remove, or restyle fields like any other blocks.',
    surfaces: ['page', 'site'],
    tags: ['form', 'contact', 'email', 'message', 'lead', 'inquiry'],
    tree: atom(
      'ContactForm',
      'flex w-full max-w-2xl flex-col gap-5 rounded-box border border-base-200 bg-base-100 p-6 shadow-sm @container',
      { ...DEFAULT_CONTACT_FORM_PROPS },
      [
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
        el('div', 'grid grid-cols-1 gap-4 @lg:grid-cols-2', {
          children: [
            field('Name', input('text', 'name', 'Jordan Avery'), { cls: 'w-full' }),
            field('Email', input('email', 'email', 'you@example.com'), { cls: 'w-full' }),
          ],
        }),
        field(
          'Message',
          atom('Textarea', 'st-c-primary st-fv-outline', {
            name: 'message',
            placeholder: 'How can we help?',
            rows: '4',
          }),
          { cls: 'w-full' }
        ),
      ]
    ),
  }),

  // ── Quote request — a Form preset that opens a CRM deal (docs/115) ───────────
  // Same wired `ContactForm` block as the contact form, but its saved routing turns
  // a submission into a sales opportunity: it adds the person to the CRM AND opens a
  // deal on the default pipeline (`addToCrm` + `openDeal`), auto-replies, and emails
  // the owner. The extra fields (phone, company, budget, timeline) are ordinary
  // named input atoms the author edits freely — this is a starting point, not a
  // fixed schema. The "What do you need a quote for?" answer is named `message`, so
  // it lands on the submission + the new customer's timeline as the deal's context.
  entry({
    key: 'quote_form',
    name: 'Quote request',
    category: 'data-input',
    kind: 'comprehensive',
    icon: 'file-text',
    description:
      'A quote-request form — collects the details you need, adds the person to your CRM, and opens a deal in your sales pipeline so nothing slips. Edit or restyle any field.',
    surfaces: ['page', 'site'],
    tags: ['form', 'quote', 'lead', 'sales', 'deal', 'estimate', 'inquiry', 'crm'],
    tree: atom(
      'ContactForm',
      'flex w-full max-w-2xl flex-col gap-5 rounded-box border border-base-200 bg-base-100 p-6 shadow-sm @container',
      {
        ...DEFAULT_CONTACT_FORM_PROPS,
        submitLabel: 'Request a quote',
        successMessage:
          "Thanks — your request is in. We'll put together a quote and get back to you shortly.",
        addToCrm: true,
        openDeal: true,
        autoresponder: true,
        autoresponderSubject: 'We received your quote request',
        autoresponderMessage:
          "Thanks for your interest — we've received your request and our team is putting together a quote. We'll be in touch soon.",
      },
      [
        el('div', 'flex flex-col gap-1', {
          children: [
            atom('Heading', 'text-lg font-semibold text-base-content', {
              level: 'h3',
              text: 'Request a quote',
            }),
            el('p', 'text-sm text-base-content/60', {
              text: "Tell us what you need and we'll send over a tailored quote.",
            }),
          ],
        }),
        el('div', 'grid grid-cols-1 gap-4 @lg:grid-cols-2', {
          children: [
            field('Name', input('text', 'name', 'Jordan Avery'), { cls: 'w-full' }),
            field('Email', input('email', 'email', 'you@example.com'), { cls: 'w-full' }),
            field('Phone', input('tel', 'phone', '(555) 123-4567'), { cls: 'w-full' }),
            field('Company', input('text', 'company', 'Acme Co.'), { cls: 'w-full' }),
          ],
        }),
        field(
          'What do you need a quote for?',
          atom('Textarea', 'st-c-primary st-fv-outline', {
            name: 'message',
            placeholder: 'Describe the project, quantities, timing — whatever helps us scope it.',
            rows: '4',
          }),
          { cls: 'w-full' }
        ),
        el('div', 'grid grid-cols-1 gap-4 @lg:grid-cols-2', {
          children: [
            field(
              'Estimated budget',
              atom('Select', 'st-c-primary st-fv-outline', {
                name: 'budget',
                options: 'Not sure yet\nUnder $1,000\n$1,000 – $5,000\n$5,000 – $25,000\n$25,000+',
              }),
              { cls: 'w-full' }
            ),
            field(
              'Ideal timeline',
              atom('Select', 'st-c-primary st-fv-outline', {
                name: 'timeline',
                options: 'As soon as possible\nWithin a month\n1 – 3 months\nJust exploring',
              }),
              { cls: 'w-full' }
            ),
          ],
        }),
      ]
    ),
  }),

  // ── Login form — Field + Input atoms in a card ───────────────────────────────
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
          field('Email', input('email', 'email', 'you@example.com'), { cls: 'w-full' }),
          // Password field with an inline "Forgot?" link above the control.
          el('div', 'flex flex-col gap-1.5', {
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
              atom('Input', 'st-c-primary st-fv-outline', {
                type: 'password',
                name: 'password',
                placeholder: '••••••••',
              }),
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

  // ── File upload — bespoke dashed dropzone wrapping a file input ───────────────
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
