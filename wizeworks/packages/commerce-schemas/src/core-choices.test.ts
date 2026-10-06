import { describe, expect, it } from 'vitest';

import { coreChoiceSide, depositInLabel, isCoreOptionName } from './core-choices';

// Every label in Gillett Diesel's Shopify catalog, as typed (sparx persona issue
// 057). Typos are his, kept on purpose: they are what a real catalog holds.
const DEPOSIT_SIDE: [string, number][] = [
  ['Accept Core Charge (+$150)', 15000],
  ['Accept Core Charge (+$275)', 27500],
  ['Accept Core Charge (+$325)', 32500],
  ['Accept Core Charge (+$500)', 50000],
  ['Accept Core Charge (+$200)', 20000],
  ['Ship now add $200 core charge', 20000],
  ['Ship now add $500 core charge', 50000],
  ['Ship now add$150 per core $900 total', 90000],
  ['Ship Now add $150 per core $1200 total', 120000],
  ['Ship now add $250 core charge', 25000],
  ['Ship Now $150 core charge', 15000],
  ['Ship now add $150 core charge', 15000],
  ['Ship now add $150 per core $1200 total', 120000],
  ['Ship now add $275 core charge', 27500],
  ['Ship now add $150', 15000],
  ['Ship now add $2000.00 core charge', 200000],
  ['Ship now add 2000.00 core charge', 200000],
  ['Ship now add $150 per core total of $1200', 120000],
  ['Ship now add $275 charge', 27500],
  ['Ship Now add $275 Core Charge', 27500],
  ['Ship Now Add $150 Core Charge', 15000],
  ['Ship now add $2000.00 core', 200000],
  ['Ship now Add $150 core charge', 15000],
  ['Ship now $250 core charge', 25000],
  ['Ship Now Add $200 Core charge', 20000],
  ['Ship now, adds $400 Core Charge', 40000],
];

const FIRST_SIDE = [
  'Defer Core Charge',
  'Ship when core received',
  'Ship after core received',
  'Ship after cores received',
  'Ship after core is received',
  'Ship When Core Received',
  'Ship after cores are recieved',
  'Ship after cores are received',
  'Ship when core is received',
  'Ship once core is received',
  'Ship after cores are receivied',
  'Ship after cores are returned',
  'Ship when cores received',
  'Ship after core returned',
];

describe('coreChoiceSide', () => {
  it('places every ship-now label in his catalog on the deposit side', () => {
    for (const [label] of DEPOSIT_SIDE) expect(coreChoiceSide(label), label).toBe('deposit');
  });

  it('places every old-part-first label in his catalog on the first side', () => {
    for (const label of FIRST_SIDE) expect(coreChoiceSide(label), label).toBe('first');
  });

  it('leaves a label that says neither for the owner', () => {
    expect(coreChoiceSide('Remanufactured')).toBeNull();
    expect(coreChoiceSide('')).toBeNull();
  });
});

describe('depositInLabel', () => {
  it('reads the deposit every ship-now label in his catalog names', () => {
    for (const [label, cents] of DEPOSIT_SIDE) expect(depositInLabel(label), label).toBe(cents);
  });

  it('reads none from a label that names no amount', () => {
    expect(depositInLabel('Defer Core Charge')).toBeNull();
  });
});

describe('isCoreOptionName', () => {
  it('knows every core option name in his catalog, and nothing else', () => {
    for (const name of [
      'Core Charge',
      'Select Core Option',
      'Select Core Type',
      'Select Core Options',
      'Select core option',
    ]) {
      expect(isCoreOptionName(name), name).toBe(true);
    }
    expect(isCoreOptionName('Size')).toBe(false);
    expect(isCoreOptionName('Scorecard')).toBe(false);
  });
});
