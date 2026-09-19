import { describe, expect, it, vi } from 'vitest';
import { installOnce } from '../../src/actions/install-once';

/**
 * A HALF-REGISTERED ENGINE THAT THINKS IT IS READY.
 *
 * Every action module latched itself with `installed = true` as the FIRST line
 * of the install, before registering anything. So a throw part-way through left
 * the module part registered and marked done, and every later call returned
 * immediately. The process then served traffic for the rest of its life missing
 * whatever came after the throw.
 *
 * What that looks like from the outside is not "this action is unimplemented".
 * It is the SAME action both working and failing: measured 2026-09-16,
 * `crm.create_task` had 446 completed steps and 8 failed, `email.send_campaign`
 * 46 and 35. 71 of the platform's 73 failed runs said "no executor registered".
 *
 * A shop owner saw the end of it as four approved returns whose confirmation
 * email never went, under a green "On" badge.
 */
describe('installOnce', () => {
  it('runs the setup once and then stops', () => {
    const setup = vi.fn();
    const install = installOnce(setup);
    install();
    install();
    install();
    expect(setup).toHaveBeenCalledTimes(1);
  });

  it('does NOT latch when the setup throws, so the next caller retries', () => {
    // This is the whole point. The old `installed = true` on line one meant one
    // bad boot was permanent.
    let attempts = 0;
    const install = installOnce(() => {
      attempts += 1;
      if (attempts === 1) throw new Error('registry not ready');
    });

    expect(() => {
      install();
    }).toThrow('registry not ready');
    expect(attempts).toBe(1);

    install();
    expect(attempts).toBe(2);

    // And once it has succeeded, it settles down.
    install();
    expect(attempts).toBe(2);
  });

  it('keeps throwing while the setup keeps failing, rather than going quiet', () => {
    // A boot that cannot succeed must fail LOUDLY every time. Silence is what
    // turned this into 71 mystery run failures instead of one obvious error.
    const install = installOnce(() => {
      throw new Error('still broken');
    });
    for (let i = 0; i < 3; i += 1) {
      expect(() => {
        install();
      }).toThrow('still broken');
    }
  });

  it('gives each wrapped setup its own latch', () => {
    const a = vi.fn();
    const b = vi.fn();
    const installA = installOnce(a);
    const installB = installOnce(b);
    installA();
    installA();
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(0);
    installB();
    expect(b).toHaveBeenCalledTimes(1);
  });
});
