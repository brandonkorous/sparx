// The Builder authoring guide an AI agent reads BEFORE it writes a page (docs/61).
//
// The Builder is "a semantic component library over a tokenized utility layer":
// every node carries a Tailwind-native `class` string that the per-tenant compile
// (@sparx/surface-compile) tree-shakes and resolves to the tenant's `--sf-*`
// theme. So a class an agent types here — `bg-primary`, `p-6`, `rounded-box`,
// `@3xl:grid-cols-3` — renders in the tenant's own colors, spacing, and shape.
// This object is the contract: the class families that resolve, the node-type
// catalog, the container-query responsive model, the binding model, and the
// safety allowlist. It's static data (no DB), surfaced by `describe_builder_styling`.
//
// Kept faithful to the SOURCES it documents: the token theme in
// @sparx/surface-compile/theme.ts, the allowlist in .../allowlist.ts, the node
// registry the editor ships, and the box→class semantics in
// @sparx/builder-schemas/box-to-class.ts. When those change, change this.

export const BUILDER_STYLE_GUIDE = {
  overview:
    'Author a Sparx site page as a tree of nodes. Every node is { id?, type, name?, class?, props, binding?, children? }. ' +
    '`type` picks a component from the catalog below; `class` is a Tailwind-native string that compiles to the tenant theme; ' +
    '`props` is component data; `binding` pulls live data; `children` nest. There is ONE styling surface — the class string. ' +
    'Containers arrange children (flex/grid); leaves render content. Pages are DRAFTs until published. ' +
    'NON-NEGOTIABLE: every page — and especially the site-layout header & footer — MUST be responsive. Author mobile-first ' +
    '(the bare utility is the phone layout) and let the layout adapt to width per `responsive` below. A site that breaks, ' +
    'overflows, or crams on a phone is unshippable — treat it as a defect, not polish.',

  documentFormat: {
    description:
      'Pass create_builder_page / update_builder_page a "document" — either this envelope or a bare node tree. ' +
      'Missing node ids are auto-filled, so you only need to emit { type, class?, props?, children? }.',
    format: 'sparx.builder/v1',
    kinds: {
      singleton:
        'One specific page (Home, About). Authored content; served at its `slug` (a slugless singleton is the site root /).',
      collection:
        'One template rendering EVERY record of `recordType` (e.g. commerce.product → every product). Nodes bind to the record.',
    },
    example: {
      format: 'sparx.builder/v1',
      type: 'page',
      name: 'About',
      kind: 'singleton',
      slug: 'about',
      tree: {
        type: 'Section',
        class: 'w-full bg-base-100',
        props: {},
        children: [
          {
            type: 'Section',
            class:
              'mx-auto w-full max-w-site flex flex-col items-center gap-2 p-16 text-center min-h-[50vh] justify-center',
            props: {},
            children: [
              {
                type: 'Text',
                class: 'text-primary',
                props: { text: 'Our story', variant: 'eyebrow' },
              },
              { type: 'Heading', props: { level: 'h1', text: 'About the studio' } },
              {
                type: 'Text',
                props: {
                  variant: 'body',
                  text: 'A few sentences on who we are and why we make things by hand.',
                },
              },
              {
                type: 'Button',
                props: { label: 'Get in touch', style: 'primary', href: '/contact' },
              },
            ],
          },
        ],
      },
    },
  },

  nodeTypes: {
    note: 'Unknown types are tolerated (the renderer skips a leaf it does not know) but prefer these. Containers accept `children`; leaves do not.',
    containers: [
      {
        type: 'Section',
        use: 'The primary band/region. Full-bleed background + a centered content column is the staple page rhythm.',
      },
      { type: 'Stack', use: 'Vertical flow of children (flex-col).' },
      {
        type: 'Grid',
        use: 'Responsive grid; pair with grid-cols-* utilities. Bind to an array to repeat one child per record.',
      },
      { type: 'Card', use: 'A bordered/elevated content box.' },
      { type: 'Carousel', use: 'A horizontally scrolling track of children.' },
    ],
    leaves: [
      { type: 'Heading', props: 'level (h1..h6), text' },
      { type: 'Text', props: 'text, variant (eyebrow | body | meta)' },
      { type: 'Prose', props: 'rich-text document (authored body copy)' },
      { type: 'Image', props: 'src, alt, ratio (square | wide | …)' },
      { type: 'Button', props: 'label, href, style (primary | soft | outline | ghost | link)' },
      { type: 'Badge', props: 'label, color' },
      { type: 'Icon', props: 'name' },
      { type: 'Divider', props: '—' },
      { type: 'Video', props: 'src / embed url' },
      { type: 'Map', props: 'address / coords' },
      { type: 'Stat', props: 'label, value' },
    ],
    dataAware: [
      {
        type: 'ImageDisplay',
        use: 'Renders an image field; bind to e.g. item.featuredImage or product.images.',
      },
      { type: 'PriceTag', use: 'Formats a price field; bind to e.g. item.price / product.price.' },
      { type: 'Signup', use: 'Newsletter/list opt-in; bind to a crm.list.' },
    ],
    chrome: [
      {
        type: 'Outlet',
        use: 'Site-layout only: marks where the routed page renders inside the header/footer shell.',
      },
      {
        type: 'NavMenu',
        use: 'Navigation links (Builder-owned, docs/57). props.links = [{ label, href }]. Not bindable.',
      },
      { type: 'Logo', use: 'Site identity mark; bind to site.identity.' },
      { type: 'SocialLinks', use: 'Social icon row; bind to site.social.' },
    ],
  },

  classVocabulary: {
    note:
      'Author Tailwind utilities directly. Every color/shape/spacing token below resolves to the tenant `--sf-*` theme at compile time — ' +
      'never hardcode hex. Unknown utilities are silently dropped (no error), so typos are safe but inert.',
    color: {
      surfaces: [
        'bg-base-100',
        'bg-base-200',
        'bg-base-300',
        'bg-primary',
        'bg-secondary',
        'bg-accent',
        'bg-neutral',
        'bg-info',
        'bg-success',
        'bg-warning',
        'bg-danger',
      ],
      text: [
        'text-base-content',
        'text-primary',
        'text-primary-content',
        'text-neutral-content',
        'text-secondary',
        'text-accent',
        'text-white',
        'text-black',
      ],
      border: ['border', 'border-border', 'border-2'],
      rule: 'Pair a fill with its -content text (bg-primary → text-primary-content; bg-neutral → text-neutral-content) for legible contrast. -content is the on-color.',
    },
    type: {
      family: ['font-heading', 'font-body'],
      size: ['text-sm', 'text-base', 'text-lg', 'text-xl', 'text-2xl', 'text-4xl', 'text-6xl'],
      weight: ['font-medium', 'font-semibold', 'font-bold'],
      align: ['text-left', 'text-center', 'text-right'],
      tracking: ['tracking-tight', 'tracking-wide'],
    },
    shape: {
      radius: ['rounded-box', 'rounded-field', 'rounded-selector', 'rounded-full'],
      note: 'radius tokens track the tenant shape scale.',
    },
    effects: {
      shadow: ['shadow-sm', 'shadow-md', 'shadow-lg'],
      misc: ['opacity-90', 'backdrop-blur'],
    },
    spacing: {
      note: 'The whole numeric spacing scale tracks the tenant base unit (--sf-space-base) — it reflows with the theme.',
      padding: ['p-3', 'p-6', 'p-10', 'p-16', 'px-6', 'py-10'],
      margin: ['m-4', 'mx-auto', 'mt-8'],
      gap: ['gap-2', 'gap-4', 'gap-6', 'gap-8'],
    },
    layout: {
      display: ['flex', 'grid', 'block', 'hidden'],
      flex: [
        'flex-col',
        'flex-row',
        'flex-wrap',
        'items-center',
        'items-start',
        'justify-center',
        'justify-between',
      ],
      grid: ['grid-cols-1', 'grid-cols-2', 'grid-cols-3', 'grid-cols-4'],
      sizing: ['w-full', 'max-w-site', 'min-h-screen', 'min-h-[50vh]', 'min-h-[75vh]'],
      centeredColumn:
        'mx-auto w-full max-w-site — the centered content column inside a full-bleed (w-full) band. This pairing is the core page rhythm.',
    },
    motion: {
      note:
        'Entrance animations ship with the theme; reduced-motion is the default posture (neutralized under the OS setting, so never add a reduced-motion guard). ' +
        'An entrance has THREE triggers — choose the class shape by WHEN it should play:',
      triggers: {
        scroll:
          'Plays as the element scrolls into view (the alive-feeling default). Emit `sf-reveal sf-reveal--<token>` (e.g. `sf-reveal sf-reveal--fade-up`). A tiny IntersectionObserver island flips it on; nothing is hidden when JS is off or reduced motion is set.',
        load: 'Plays once on first paint. Emit the bare `animate-<token>` (e.g. `animate-fade-up`).',
        hover: 'Plays on hover. Emit `hover:animate-<token>` (e.g. `hover:animate-scale-in`).',
      },
      tokens: ['fade-in', 'fade-up', 'fade-down', 'scale-in', 'slide-in-left', 'slide-in-right'],
      stagger:
        'On a CONTAINER, `sf-reveal-stagger` (or `sf-reveal-stagger--bold`) fades its direct children in sequence as it scrolls into view — do NOT also put a reveal on each child.',
      transitions: ['transition', 'duration-300', 'ease-out', 'hover:scale-105'],
    },
    states: {
      note: 'Variant prefixes compose on any utility.',
      examples: ['hover:bg-primary', 'focus:ring-2', 'dark:bg-base-300'],
    },
  },

  responsive: {
    mandate:
      'REQUIRED on every page. Responsiveness is a top-priority platform rule — a fixed desktop-only arrangement is a release ' +
      'blocker, not a refinement. Author the base (no-prefix) utility as the MOBILE layout, then widen with `@`-prefixed steps. ' +
      'Never assume a single width.',
    strategy:
      'CONTAINER QUERIES, not viewport. A node responds to its OWN width with `@`-prefixed variants, so a component is responsive ' +
      'wherever it is placed. Author mobile-first (the base utility) then step up at container breakpoints.',
    breakpoints: ['@sm', '@md', '@lg', '@xl', '@2xl', '@3xl', '@4xl', '@5xl', '@6xl', '@7xl'],
    examples: [
      'grid-cols-1 @2xl:grid-cols-2 @4xl:grid-cols-3  — one column on narrow, stepping up as the container widens',
      'flex-col @3xl:flex-row  — stacked on narrow, side-by-side once wide',
      'p-6 @3xl:p-16  — tighter padding on small containers',
    ],
    headerFooter:
      'The site-layout header & footer are the #1 failure points — give them extra care. HEADER: a row of items (logo · nav · ' +
      'CTA) stacks to a centered column on narrow widths (author `flex flex-col @3xl:flex-row`); keep the link set short and ' +
      'avoid fixed-width children (no `min-w-[…]` / `w-[200px]` on the CTA) so nothing overflows. FOOTER: put link groups in a ' +
      'Grid (it collapses N→2→1 by container width), never a single fixed row that runs off a phone. Verify both at a ~375px width.',
  },

  binding: {
    description:
      'A node may bind to a path in the current data scope (`binding.path`). Cardinality drives behavior: an OBJECT path sets the ' +
      'scope for the subtree (renders once); an ARRAY path on a container ITERATES — the children render once per item, with `item.*` ' +
      'in scope. A leaf binds a single field. A node with no binding is static.',
    examples: [
      'cms.blog_post[0]  (object → latest post sets scope)',
      'cms.blog_post     (array on a Grid → one card per post)',
      'item.title        (field, inside an iterating scope)',
      'product.price     (collection template for commerce.product)',
      'site.identity     (Logo), site.social (SocialLinks)',
    ],
    collectionTemplates:
      'A `collection` page binds the in-scope record by `recordType`: a commerce.product template uses product.*, a cms.blog_post template uses blog_post.* (or item.* under an iterator).',
  },

  allowlist: {
    note: 'The per-tenant compile drops a small denylist of weaponizable classes even though they are "just utilities". Everything else Tailwind emits is allowed.',
    blocked: [
      'fixed — position:fixed (clickjacking overlay). Use sticky/relative + the overlay-header preset instead.',
      'z-[…] — arbitrary z-index escalation. The z-0..z-50 scale is allowed.',
      'content-[…] — arbitrary generated content (injection vector).',
      'any url(…) — external load / exfiltration. Set images via props (Image src / a Section background image prop), never a bg-[url(…)] class.',
    ],
    images:
      'Put image URLs in props (e.g. an Image node `src`, or a Section background-image prop), not in a class — url() in a class is blocked.',
  },

  recipes: [
    {
      name: 'Full-bleed hero with a centered column',
      tree: {
        type: 'Section',
        class:
          'w-full bg-neutral text-neutral-content min-h-[75vh] flex items-center justify-center',
        props: {},
        children: [
          {
            type: 'Stack',
            class:
              'mx-auto w-full max-w-site flex flex-col items-center gap-4 p-16 text-center animate-fade-up',
            props: {},
            children: [
              { type: 'Heading', props: { level: 'h1', text: 'Big bold promise' } },
              { type: 'Text', props: { variant: 'body', text: 'A supporting sentence.' } },
              { type: 'Button', props: { label: 'Shop now', style: 'primary', href: '/products' } },
            ],
          },
        ],
      },
    },
    {
      name: 'Responsive product grid (iterates over a collection)',
      tree: {
        type: 'Section',
        class: 'mx-auto w-full max-w-site flex flex-col gap-6 p-10',
        props: {},
        children: [
          { type: 'Heading', props: { level: 'h2', text: 'Featured' } },
          {
            type: 'Grid',
            class: 'grid grid-cols-1 @2xl:grid-cols-2 @4xl:grid-cols-3 gap-6',
            props: {},
            binding: { path: 'commerce.product' },
            children: [
              {
                type: 'Card',
                class: 'flex flex-col gap-2 rounded-box border border-border p-3',
                props: {},
                children: [
                  {
                    type: 'ImageDisplay',
                    props: { ratio: 'square' },
                    binding: { path: 'item.images' },
                  },
                  { type: 'Heading', props: { level: 'h3' }, binding: { path: 'item.title' } },
                  { type: 'PriceTag', props: {}, binding: { path: 'item.price' } },
                  { type: 'Button', props: { label: 'Add to cart', style: 'soft' } },
                ],
              },
            ],
          },
        ],
      },
    },
    {
      name: 'Scroll-reveal feature row (entrance motion)',
      tree: {
        type: 'Section',
        class: 'mx-auto w-full max-w-site flex flex-col gap-8 p-16',
        props: {},
        children: [
          {
            type: 'Heading',
            // scroll trigger: the heading fades up as it enters the viewport
            class: 'sf-reveal sf-reveal--fade-up text-center',
            props: { level: 'h2', text: 'Why teams choose us' },
          },
          {
            type: 'Grid',
            // container stagger: the cards fade up in sequence on reveal (no per-card reveal)
            class: 'grid grid-cols-1 @2xl:grid-cols-3 gap-6 sf-reveal-stagger',
            props: {},
            children: [
              {
                type: 'Card',
                class: 'flex flex-col gap-2 rounded-box border border-border p-6',
                props: {},
                children: [
                  { type: 'Heading', props: { level: 'h3', text: 'Fast' } },
                  { type: 'Text', props: { variant: 'body', text: 'Sub-second pages.' } },
                ],
              },
            ],
          },
        ],
      },
    },
  ],

  workflow:
    'Typical loop: (1) describe_builder_styling once to load this guide. (2) list_builder_pages to see the catalog; get_builder_page to read an existing tree. (3) create_builder_page or update_builder_page with your document (saves a DRAFT). (4) publish_builder_page to take it live (confirmation-gated).',
} as const;

export type BuilderStyleGuide = typeof BUILDER_STYLE_GUIDE;
