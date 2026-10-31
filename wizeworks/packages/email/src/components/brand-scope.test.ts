// api-rest sends sign-in mail for both brands from one process, each inside the
// request's brand scope. The fallback identity used to be resolved once per
// process, so whichever brand sent first put its name on the other's mail.

import { afterEach, describe, expect, it } from 'vitest';
import { runAsBrand } from '@wizeworks/brand-core/request-scope';

import { platformNameOf } from './brand';

const TOUCHED = ['SPARX_BRAND_NAME', 'PIGGLES_BRAND_NAME'] as const;
const saved = Object.fromEntries(TOUCHED.map((k) => [k, process.env[k]]));

afterEach(() => {
  for (const k of TOUCHED) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe('the fallback identity in a process serving two brands', () => {
  it("names each brand's mail after that brand, whichever sends first", () => {
    process.env.SPARX_BRAND_NAME = 'sparx';
    process.env.PIGGLES_BRAND_NAME = 'Piggles';
    expect(runAsBrand('piggles', () => platformNameOf())).toBe('Piggles');
    expect(runAsBrand('sparx', () => platformNameOf())).toBe('sparx');
    expect(runAsBrand('piggles', () => platformNameOf())).toBe('Piggles');
  });
});
