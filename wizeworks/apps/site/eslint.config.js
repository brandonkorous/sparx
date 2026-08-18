// wizeworks/apps/site ESLint — extends root + same "no raw Tailwind in feature
// code" enforcement as apps/web. Layout chrome should compose @wizeworks/ui
// primitives; CMS-rendered content (TipTap → HTML) is sanitized inside
// @wizeworks/cms-editor's serializer.

import rootConfig from '../../../eslint.config.js';

export default [
  ...rootConfig,
  {
    files: ['app/**/*.{ts,tsx}', 'components/**/*.{ts,tsx}'],
    settings: {
      // Map field components to the DOM elements they render, so jsx-a11y
      // resolves a `<label>` wrapping one as an associated control (the native
      // control is nested at runtime).
      //
      // This RE-LISTS the root config's silica map rather than adding to it:
      // flat config REPLACES `settings['jsx-a11y']` wholesale instead of
      // deep-merging, so anything omitted here is silently lost for these files.
      'jsx-a11y': {
        components: {
          Checkbox: 'input',
          Input: 'input',
          NativeSelect: 'select',
          Textarea: 'textarea',
        },
      },
    },
    rules: {
      'no-restricted-syntax': [
        'warn',
        {
          // See docs/23 §15: flags a background FILL paired with a foreground
          // TEXT COLOR (reimplementing a styled control). Layout/positioning/
          // spacing and lone color usage pass through.
          selector:
            'JSXAttribute[name.name="className"][value.type="Literal"][value.value=/(?=.*(?:bg-\\[(?:var\\(|#|rgb|hsl|oklch)|bg-white|bg-black))(?=.*(?:text-\\[(?:var\\(|#|rgb|hsl|oklch)|text-white|text-black))/]',
          message:
            'This className pairs a background fill with a foreground text color — that reimplements a styled control. Use a @wizeworks/ui component/variant or inline styles with CSS vars from tokens.css. Layout, spacing, and positioning utilities are fine (docs/23 §15).',
        },
      ],
    },
  },
];
