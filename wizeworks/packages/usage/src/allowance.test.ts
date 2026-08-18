import { afterEach, describe, expect, it } from 'vitest';
import { APPROACHING, readMeter, resolveCapacityAllowance } from './allowance';

// What this pins is mostly the difference between a non-answer and an answer.
// Three of the five meter states are non-answers — `unmetered`, `unknown`, and an
// undecided ceiling — and every one of them renders identically to a measurement
// if it is allowed to collapse into `ok` or into zero. That collapse is the whole
// bug class here, so each of them gets its own case.

const VAR = 'TESTBRAND_CAPACITY';

function setCapacity(value: string | undefined) {
  if (value === undefined) delete process.env[VAR];
  else process.env[VAR] = value;
}

afterEach(() => setCapacity(undefined));

describe('readMeter', () => {
  it('reports no ceiling as `unmetered`, which is not `ok`', () => {
    const m = readMeter('storageBytes', 5_000n, null);
    // "We are not answering that question" — a surface must render this
    // differently from a comfortable meter, and can only do so if it is told.
    expect(m.state).toBe('unmetered');
    // No fraction, so nothing can draw a bar against a limit nobody set.
    expect(m.fraction).toBeNull();
  });

  it('reports an unmeasured value as `unknown`, which is not zero', () => {
    const m = readMeter('contacts', null, 10_000n);
    expect(m.state).toBe('unknown');
    expect(m.used).toBeNull();
    expect(m.fraction).toBeNull();
  });

  it('warns at the threshold, not past it', () => {
    // At exactly 80% the notice is still useful; a strict `>` would wait for 81%
    // and on a small allowance there is no 81%.
    expect(readMeter('seats', 8n, 10n).state).toBe('approaching');
    expect(readMeter('seats', 7n, 10n).state).toBe('ok');
    expect(APPROACHING).toBe(0.8);
  });

  it('warns at exactly the limit rather than calling it fine', () => {
    // 3 of 3 seats is the moment the next invitation pauses. `ok` here would mean
    // the first warning somebody gets is the failure itself.
    const m = readMeter('seats', 3n, 3n);
    expect(m.state).toBe('approaching');
    expect(m.fraction).toBe(1);
  });

  it('does not clamp an overage', () => {
    // 120% has to read as 120%: rounding it to "full" hides both how far over
    // they are and how much expansion would fix it.
    const m = readMeter('contacts', 12n, 10n);
    expect(m.state).toBe('over');
    expect(m.fraction).toBeCloseTo(1.2);
  });

  it('survives a zero allowance without dividing by it', () => {
    // A brand that includes none of something is a real position, and 0/0 is not
    // a percentage.
    expect(readMeter('locations', 0n, 0n).fraction).toBeNull();
    expect(readMeter('locations', 1n, 0n).state).toBe('over');
  });
});

describe('resolveCapacityAllowance', () => {
  it('treats an unset brand as every meter unmetered', () => {
    // This is sparx's real configuration: it sells per module, not per capacity.
    const { allowance, source } = resolveCapacityAllowance('testbrand');
    expect(source).toBe('none');
    expect(allowance.seats).toBeNull();
    expect(allowance.storageBytes).toBeNull();
  });

  it('accepts a PARTIAL allowance, unlike the email palette', () => {
    // "3 seats, and storage is not yet decided" is a coherent commercial position
    // and the exact one Piggles is in. Refusing the whole object over the one
    // undecided meter would throw away four decisions that were made.
    setCapacity(JSON.stringify({ seats: 3, sites: 1, locations: 1, contacts: 10_000 }));
    const { allowance, source, rejected } = resolveCapacityAllowance('testbrand');

    expect(source).toBe('configured');
    expect(rejected).toEqual([]);
    expect(allowance.seats).toBe(3);
    expect(allowance.contacts).toBe(10_000);
    // The two the pricing sheet leaves as ranges stay null — metered, no ceiling.
    expect(allowance.storageBytes).toBeNull();
    expect(allowance.emailSendsPerMonth).toBeNull();
  });

  it('takes a byte count as a string, since JSON numbers run out', () => {
    setCapacity(JSON.stringify({ storageBytes: '25000000000' }));
    expect(resolveCapacityAllowance('testbrand').allowance.storageBytes).toBe(25_000_000_000n);
  });

  it('keeps zero, which means "this brand includes none"', () => {
    setCapacity(JSON.stringify({ locations: 0 }));
    const { allowance, source } = resolveCapacityAllowance('testbrand');
    expect(source).toBe('configured');
    expect(allowance.locations).toBe(0);
  });

  it.each([
    ['a negative number', -1],
    ['a fraction', 2.5],
    ['a non-numeric string', 'three'],
    ['null', null],
  ])('rejects %s to NULL and reports it', (_label, value) => {
    // Degrading to "no ceiling" is safe: it warns nobody. Degrading to a DEFAULT
    // would warn or block on a number nobody wrote.
    setCapacity(JSON.stringify({ seats: value }));
    const { allowance, rejected } = resolveCapacityAllowance('testbrand');
    expect(allowance.seats).toBeNull();
    expect(rejected).toContain('seats');
  });

  it('reports a meter name it does not recognise', () => {
    // A typo'd key is a ceiling somebody believes is set. Silently dropping it
    // makes a misconfiguration indistinguishable from a deliberate absence.
    setCapacity(JSON.stringify({ seats: 3, storage: '10' }));
    const { allowance, source, rejected } = resolveCapacityAllowance('testbrand');
    expect(source).toBe('configured');
    expect(allowance.seats).toBe(3);
    expect(rejected).toContain('storage');
  });

  it.each([
    ['malformed JSON', '{"seats":'],
    ['an array', '[3]'],
    ['a bare number', '3'],
  ])('survives %s without throwing', (_label, value) => {
    setCapacity(value);
    expect(() => resolveCapacityAllowance('testbrand')).not.toThrow();
    expect(resolveCapacityAllowance('testbrand').source).toBe('none');
  });
});
