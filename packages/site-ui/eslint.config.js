// @sparx/site-ui ESLint — extends the root flat config.
//
// Like @sparx/ui, this package may write component CSS class names freely; the
// "no raw Tailwind / re-skinned control in feature code" rule (docs/23 §15)
// lives in the apps/* configs, NOT here. site-ui authors the components those
// apps compose, against the tenant --sf-* tokens.

import rootConfig from '../../eslint.config.js';

export default [
  // Build scripts (e.g. scope-canvas.mjs) are Node tooling, not library source —
  // they sit outside the package tsconfig, so the typed-lint project service
  // can't resolve them. Ignore them here, mirroring how the root config ignores
  // *.config.* files.
  { ignores: ['scripts/**'] },
  ...rootConfig,
];
