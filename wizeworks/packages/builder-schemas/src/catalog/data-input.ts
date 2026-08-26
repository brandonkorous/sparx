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

import { el, atom, entry, part, type PlatformCatalogEntry } from './_kit';
import { DEFAULT_CONTACT_FORM_PROPS } from '../forms';

type Node = ReturnType<typeof atom>;

// A bare text-style input atom (st-input) carrying the field recipe.
const input = (type: string, name: string, placeholder: string): Node =>
  atom('Input', 'input-primary', { type, name, placeholder });

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
        atom(control, control === 'Checkbox' ? 'checkbox-primary' : 'radio-primary', { name }),
        el('span', 'text-sm text-base-content', { text: caption }),
      ],
    }
  );

// The bare control inside the bespoke search join — chromeless, blends into the join.
const SEARCH_CONTROL =
  'w-full bg-transparent text-sm text-base-content outline-none placeholder:text-base-content';

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
      atom('Textarea', 'input-primary', {
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
      atom('Select', 'input-primary', {
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
            el('span', 'text-xs text-base-content', {
              text: 'Receive an email when something needs you.',
            }),
          ],
        }),
        atom('Switch', 'toggle-primary', { name: 'notifications' }),
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
        atom('Range', 'range-primary w-full', { name: 'budget', min: '0', max: '10000' }),
        el('span', 'flex items-center justify-between text-xs text-base-content', {
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
              atom('Icon', 'h-4 w-4 shrink-0 text-base-content', { name: 'search' }),
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
        atom('Button', 'btn btn-primary btn-md rounded-l-none', {
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
            el('p', 'text-sm text-base-content', {
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
          atom('Textarea', 'input-primary', {
            name: 'message',
            placeholder: 'How can we help?',
            rows: '4',
          }),
          { cls: 'w-full' }
        ),
      ]
    ),
  }),

  // ── Multi-step form — the same block, asked one screen at a time (docs/152 C2) ─
  //
  // Not a different component: it is the SAME wired `ContactForm`, with its
  // children grouped into containers marked `part(…, 'item')`. The island reads
  // those marks off the rendered DOM and shows one at a time, which is why an
  // author can add, remove or reorder a step with the ordinary builder and why a
  // form with no marks behaves exactly as it always did.
  //
  // THE EMAIL IS ON STEP ONE, and that is the whole point of the arrangement.
  // Somebody who fills in the first screen and leaves is recorded as a partial
  // submission — a lead the tenant can still see — where before they were
  // nothing at all. Ask for the address last and there is nothing to keep.
  entry({
    key: 'form_multi_step',
    name: 'Multi-step form',
    category: 'data-input',
    kind: 'comprehensive',
    icon: 'list-checks',
    description:
      'A longer form asked one screen at a time, which people finish far more often than one long page. Anyone who gives their email on the first screen and stops is still saved as a lead.',
    surfaces: ['page', 'site'],
    tags: ['form', 'multi step', 'wizard', 'steps', 'lead', 'quote', 'qualify', 'contact'],
    tree: atom(
      'ContactForm',
      'flex w-full max-w-2xl flex-col gap-5 rounded-box border border-base-200 bg-base-100 p-6 @container',
      { ...DEFAULT_CONTACT_FORM_PROPS },
      [
        el('div', 'flex flex-col gap-1', {
          children: [
            atom('Heading', 'text-lg font-semibold text-base-content', {
              level: 'h3',
              text: 'Tell us what you need',
            }),
            el('p', 'text-sm text-base-content', {
              text: 'Three quick screens, about a minute.',
            }),
          ],
        }),

        part(
          el('div', 'flex flex-col gap-4', {
            name: 'Step 1 — who they are',
            children: [
              field('Name', input('text', 'name', 'Jordan Avery'), { cls: 'w-full' }),
              field('Email', input('email', 'email', 'you@example.com'), { cls: 'w-full' }),
            ],
          }),
          'item'
        ),

        part(
          el('div', 'flex flex-col gap-4', {
            name: 'Step 2 — what they want',
            children: [
              field(
                'What can we help with?',
                atom('Select', 'input-primary', {
                  name: 'topic',
                  options: 'A new project\nAn existing order\nSomething else',
                }),
                { cls: 'w-full' }
              ),
              field('Phone', input('tel', 'phone', '(555) 010-0199'), { cls: 'w-full' }),
            ],
          }),
          'item'
        ),

        part(
          el('div', 'flex flex-col gap-4', {
            name: 'Step 3 — the detail',
            children: [
              field(
                'Anything else we should know?',
                atom('Textarea', 'input-primary', {
                  name: 'message',
                  placeholder: 'A sentence or two is plenty.',
                  rows: '4',
                }),
                { cls: 'w-full' }
              ),
            ],
          }),
          'item'
        ),
      ]
    ),
  }),

  // ── Quiz — a scored form that tells the visitor where they landed (docs/152 C3) ─
  //
  // Same `ContactForm` block, same stepped arrangement as the multi-step entry.
  // What makes it a quiz is `scoring`: weights, bands, and whether the result
  // should move the person's CRM score.
  //
  // `scoring` is a SECRET prop (see CONTACT_FORM_SECRET_PROPS). At publish it is
  // lifted into the server-only FormDefinition row and deleted from the tree the
  // browser gets — otherwise a visitor could read which answers are worth what
  // and hand the sales team a "hot lead" who simply read the source.
  entry({
    key: 'quiz_fit',
    name: 'Quiz',
    category: 'data-input',
    kind: 'comprehensive',
    icon: 'clipboard-check',
    description:
      'A few questions that end in a personalised answer for the visitor, and a real lead score for you. People finish these far more often than a plain contact form.',
    surfaces: ['page', 'site'],
    tags: ['quiz', 'score', 'assessment', 'qualify', 'lead', 'form', 'questions'],
    tree: atom(
      'ContactForm',
      'flex w-full max-w-2xl flex-col gap-5 rounded-box border border-base-200 bg-base-100 p-6 @container',
      {
        ...DEFAULT_CONTACT_FORM_PROPS,
        submitLabel: 'See my result',
        addToCrm: true,
        scoring: {
          weights: {
            team_size: { 'Just me': 0, '2 to 10': 10, 'More than 10': 25 },
            timing: { 'Just looking': 0, 'In the next few months': 15, 'As soon as possible': 30 },
          },
          outcomes: [
            {
              minScore: 0,
              headline: 'Start with the basics',
              body: 'Have a look around at your own pace — everything here works on the free plan.',
            },
            {
              minScore: 30,
              headline: 'You are ready for more than the basics',
              body: 'Worth a short call to work out which parts are worth turning on first.',
            },
            {
              minScore: 50,
              headline: 'Let us talk this week',
              body: 'You have the size and the timing for this to pay for itself quickly.',
            },
          ],
          multiplier: null,
          scoreContact: true,
          reason: 'Answered the fit quiz',
        },
      },
      [
        el('div', 'flex flex-col gap-1', {
          children: [
            atom('Heading', 'text-lg font-semibold text-base-content', {
              level: 'h3',
              text: 'Which setup fits you?',
            }),
            el('p', 'text-sm text-base-content', { text: 'Two questions, about twenty seconds.' }),
          ],
        }),
        part(
          el('div', 'flex flex-col gap-4', {
            name: 'Question 1',
            children: [
              field(
                'How many people are in your team?',
                atom('Select', 'input-primary', {
                  name: 'team_size',
                  options: 'Just me\n2 to 10\nMore than 10',
                }),
                { cls: 'w-full' }
              ),
            ],
          }),
          'item'
        ),
        part(
          el('div', 'flex flex-col gap-4', {
            name: 'Question 2',
            children: [
              field(
                'When are you looking to make a change?',
                atom('Select', 'input-primary', {
                  name: 'timing',
                  options: 'Just looking\nIn the next few months\nAs soon as possible',
                }),
                { cls: 'w-full' }
              ),
            ],
          }),
          'item'
        ),
        part(
          el('div', 'flex flex-col gap-4', {
            name: 'Where to send it',
            children: [
              field('Name', input('text', 'name', 'Jordan Avery'), { cls: 'w-full' }),
              field('Email', input('email', 'email', 'you@example.com'), { cls: 'w-full' }),
            ],
          }),
          'item'
        ),
      ]
    ),
  }),

  // ── Calculator — the same machine, reporting a quantity ──────────────────────
  //
  // Deliberately a weighted sum times a rate, not an author-written formula. An
  // expression language would mean shipping a parser and an evaluator that run on
  // submitted input, which is a lot of risk to buy a feature nobody asked for,
  // and every real "how much could you save" calculator is this shape anyway.
  //
  // `scoreContact` is OFF here. Someone working out a number for themselves has
  // not told you they are ready to buy, and scoring them for curiosity would put
  // a claim in the CRM that the visitor never made.
  entry({
    key: 'calculator_savings',
    name: 'Savings calculator',
    category: 'data-input',
    kind: 'comprehensive',
    icon: 'calculator',
    description:
      'Asks a couple of questions and shows the visitor a number — what they could save, earn, or get back. Captures their email along the way.',
    surfaces: ['page', 'site'],
    tags: ['calculator', 'estimate', 'savings', 'roi', 'quote', 'lead', 'form'],
    tree: atom(
      'ContactForm',
      'flex w-full max-w-2xl flex-col gap-5 rounded-box border border-base-200 bg-base-100 p-6 @container',
      {
        ...DEFAULT_CONTACT_FORM_PROPS,
        submitLabel: 'Show me the number',
        addToCrm: true,
        scoring: {
          weights: {
            monthly_orders: { 'Under 50': 50, '50 to 500': 500, 'More than 500': 2000 },
            handling: { 'By hand': 3, 'Part automated': 1, 'Fully automated': 0 },
          },
          outcomes: [],
          multiplier: { perPoint: 1.4, prefix: '$', suffix: ' a year' },
          scoreContact: false,
          reason: 'Used the savings calculator',
        },
      },
      [
        el('div', 'flex flex-col gap-1', {
          children: [
            atom('Heading', 'text-lg font-semibold text-base-content', {
              level: 'h3',
              text: 'What could you save?',
            }),
            el('p', 'text-sm text-base-content', {
              text: 'Two questions and we will show you a rough figure.',
            }),
          ],
        }),
        part(
          el('div', 'flex flex-col gap-4', {
            name: 'How much they handle',
            children: [
              field(
                'Roughly how many orders a month?',
                atom('Select', 'input-primary', {
                  name: 'monthly_orders',
                  options: 'Under 50\n50 to 500\nMore than 500',
                }),
                { cls: 'w-full' }
              ),
              field(
                'How do you handle them today?',
                atom('Select', 'input-primary', {
                  name: 'handling',
                  options: 'By hand\nPart automated\nFully automated',
                }),
                { cls: 'w-full' }
              ),
            ],
          }),
          'item'
        ),
        part(
          el('div', 'flex flex-col gap-4', {
            name: 'Where to send it',
            children: [
              field('Email', input('email', 'email', 'you@example.com'), { cls: 'w-full' }),
            ],
          }),
          'item'
        ),
      ]
    ),
  }),

  // ── Gated download — a file in exchange for an address (docs/152 C4) ─────────
  //
  // Ships with NO file attached, deliberately. The asset is a storage key in the
  // private bucket, so there is nothing sensible to hardcode here — the author
  // picks their own file in the form's settings, and until they do this behaves
  // as an ordinary contact form rather than promising a download that does not
  // exist.
  //
  // The file is EMAILED, never linked from the thank-you page. That is the whole
  // difference between a gate and a formality: a download button on the success
  // page hands the file to anyone who types anything, and the business ends up
  // hosting a public file that also collects addresses.
  entry({
    key: 'gated_download',
    name: 'Free download',
    category: 'data-input',
    kind: 'comprehensive',
    icon: 'file-down',
    description:
      'Offers a guide, price list, or template in exchange for an email address. The file is emailed as a private link that expires, so it stays worth asking for.',
    surfaces: ['page', 'site'],
    tags: ['download', 'gated', 'lead magnet', 'guide', 'ebook', 'pdf', 'form', 'lead'],
    tree: atom(
      'ContactForm',
      'flex w-full max-w-xl flex-col gap-5 rounded-box border border-base-200 bg-base-100 p-6 @container',
      {
        ...DEFAULT_CONTACT_FORM_PROPS,
        submitLabel: 'Send it to me',
        addToCrm: true,
        successMessage: 'On its way — check your inbox in a minute or two.',
      },
      [
        el('div', 'flex flex-col gap-1', {
          children: [
            atom('Heading', 'text-lg font-semibold text-base-content', {
              level: 'h3',
              text: 'Get the guide',
            }),
            el('p', 'text-sm text-base-content', {
              text: 'Tell us where to send it and it will be in your inbox in a minute.',
            }),
          ],
        }),
        el('div', 'grid grid-cols-1 gap-4 @lg:grid-cols-2', {
          children: [
            field('Name', input('text', 'name', 'Jordan Avery'), { cls: 'w-full' }),
            field('Email', input('email', 'email', 'you@example.com'), { cls: 'w-full' }),
          ],
        }),
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
            el('p', 'text-sm text-base-content', {
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
          atom('Textarea', 'input-primary', {
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
              atom('Select', 'input-primary', {
                name: 'budget',
                options: 'Not sure yet\nUnder $1,000\n$1,000 – $5,000\n$5,000 – $25,000\n$25,000+',
              }),
              { cls: 'w-full' }
            ),
            field(
              'Ideal timeline',
              atom('Select', 'input-primary', {
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

  // ── Support request — a Form preset that opens a CRM request (docs/144 §7) ──
  // The sibling of `quote_form`, and the reason the Requests queue has anything in
  // it on a site that has never connected a mailbox. Same wired `ContactForm`
  // block; the difference is entirely in the saved routing — `openRequest` files
  // the submission as a support request with a reply deadline attached, counted in
  // the hours the business actually works.
  //
  // `addToCrm` is set alongside it rather than left to the normalizer's implication
  // so the saved tree states its own intent plainly: there is somebody to reply to.
  // The autoresponder is ON, unlike the plain contact form — when a person has
  // asked for help, silence is the failure mode, and the confirmation is the first
  // half of the promise the request's clock is now measuring.
  //
  // The answer to "What went wrong?" is named `message`, so it lands on the
  // submission, on the customer's timeline, and as the request's description —
  // which is what stops the queue showing rows nobody can triage without digging.
  entry({
    key: 'support_form',
    name: 'Support request',
    category: 'data-input',
    kind: 'comprehensive',
    icon: 'life-buoy',
    description:
      'A help form — collects what went wrong, adds the person to your CRM, and opens a support request with a reply deadline so nothing waits longer than you promised. Edit or restyle any field.',
    surfaces: ['page', 'site'],
    tags: ['form', 'support', 'help', 'service', 'request', 'ticket', 'contact', 'crm'],
    tree: atom(
      'ContactForm',
      'flex w-full max-w-2xl flex-col gap-5 rounded-box border border-base-200 bg-base-100 p-6 shadow-sm @container',
      {
        ...DEFAULT_CONTACT_FORM_PROPS,
        submitLabel: 'Send request',
        successMessage:
          "Thanks — we've got your request and someone will get back to you. Check your email for a copy.",
        addToCrm: true,
        openRequest: true,
        autoresponder: true,
        autoresponderSubject: 'We got your request',
        autoresponderMessage:
          "Thanks for getting in touch — we've received your request and someone will get back to you shortly. There is nothing else you need to do.",
      },
      [
        el('div', 'flex flex-col gap-1', {
          children: [
            atom('Heading', 'text-lg font-semibold text-base-content', {
              level: 'h3',
              text: 'Need a hand?',
            }),
            el('p', 'text-sm text-base-content', {
              text: "Tell us what is going on and we'll sort it out.",
            }),
          ],
        }),
        el('div', 'grid grid-cols-1 gap-4 @lg:grid-cols-2', {
          children: [
            field('Name', input('text', 'name', 'Jordan Avery'), { cls: 'w-full' }),
            field('Email', input('email', 'email', 'you@example.com'), { cls: 'w-full' }),
          ],
        }),
        field('What do you need help with?', input('text', 'subject', 'Order arrived damaged'), {
          cls: 'w-full',
        }),
        field(
          'What went wrong?',
          atom('Textarea', 'input-primary', {
            name: 'message',
            placeholder:
              'What happened, and what you expected instead. Order numbers and dates help.',
            rows: '4',
          }),
          { cls: 'w-full' }
        ),
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
              el('p', 'text-sm text-base-content', { text: 'Sign in to manage your account.' }),
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
              atom('Input', 'input-primary', {
                type: 'password',
                name: 'password',
                placeholder: '••••••••',
              }),
            ],
          }),
          atom('Button', 'btn btn-primary btn-md w-full', {
            label: 'Sign in',
          }),
          el('p', 'text-center text-sm text-base-content', {
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
            'flex h-12 w-12 items-center justify-center rounded-full bg-base-100 text-base-content shadow-sm',
            {
              children: [atom('Icon', 'h-5 w-5', { name: 'upload-cloud' })],
            }
          ),
          el('span', 'flex flex-col gap-0.5', {
            children: [
              el('span', 'text-sm font-medium text-base-content', {
                text: 'Click to upload or drag and drop',
              }),
              el('span', 'text-xs text-base-content', { text: 'PNG, JPG, or PDF up to 10 MB' }),
            ],
          }),
          el('input', 'sr-only', { attrs: { type: 'file', name: 'attachment' } }),
        ],
      }
    ),
  }),
];
