// apps/workbench ESLint — extends root + the same "no raw Tailwind re-skinning
// in feature code" enforcement as apps/market / apps/site / apps/web.
//
// Note the deliberate carve-out below: the dock chrome (`lib/dock/**`) skins
// dockview, a third-party layout engine whose own class names we must target to
// make panes look like sparx rather than a widget library. That is genuinely
// "component library" work living in an app, so it is exempt from the
// re-skinning rule — feature surfaces under `surfaces/**` are not.

import rootConfig from '../../eslint.config.js';

export default [
  ...rootConfig,
  {
    files: ['app/**/*.{ts,tsx}', 'components/**/*.{ts,tsx}', 'surfaces/**/*.{ts,tsx}'],
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
            'This className pairs a background fill with a foreground text color — that reimplements a styled control. Use a silicaui component/variant or inline styles with CSS vars from the sparx theme. Layout, spacing, and positioning utilities are fine (docs/23 §15).',
        },
      ],
    },
  },
];
