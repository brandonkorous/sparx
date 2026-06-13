// Email design tokens. The VALUES live in `@sparx/builder-schemas`'s
// `EMAIL_DESIGN` (a pure, client+server-safe module) so the real renderer here and
// the Email Builder canvas preview (apps/dashboard) paint the exact same scale and
// can't drift. This module just re-exports them under the names the @sparx/email
// primitives already use — hex strings (no CSS variables) because mail clients
// strip <style> blocks and every value ends up inlined on the rendered element.

import { EMAIL_DESIGN } from '@sparx/builder-schemas';

export const colors = EMAIL_DESIGN.colors;

// Typography scale. `lineHeight` is in px so mail clients don't interpret the
// unitless number as a ratio against client-injected font sizes.
export const typography = EMAIL_DESIGN.typography;

export const radius = EMAIL_DESIGN.radius;

// Vertical rhythm. Most spacing in emails reads better as multiples of 8.
export const spacing = EMAIL_DESIGN.spacing;

export const fontFamily = EMAIL_DESIGN.fontFamily;
