// @sparx/surface-compile ESLint — extends the root flat config.
//
// Server-side package (no React, no JSX); the root config's TypeScript rules
// apply unchanged.

import rootConfig from '../../eslint.config.js';

export default [...rootConfig];
