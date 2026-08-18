// @wizeworks/builder-render ESLint — extends the root flat config.
//
// This package authors the components the apps compose, so
// the "no raw Tailwind / re-skinned control in feature code" rule (docs/23 §15)
// does NOT apply here — it lives in the apps/* configs. This package writes
// component class names (including the `st-*` recipe + `bx-*` editor chrome)
// freely against the tenant `--st-*` tokens.

import rootConfig from '../../../eslint.config.js';

export default [...rootConfig];
