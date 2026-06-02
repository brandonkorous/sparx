// @sparx/site-ui ESLint — extends the root flat config.
//
// Like @sparx/ui, this package may write component CSS class names freely; the
// "no raw Tailwind / re-skinned control in feature code" rule (docs/23 §15)
// lives in the apps/* configs, NOT here. site-ui authors the components those
// apps compose, against the tenant --sf-* tokens.

import rootConfig from '../../eslint.config.js';

export default [...rootConfig];
