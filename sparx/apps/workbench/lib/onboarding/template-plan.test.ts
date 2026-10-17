// What "Use this starting point" does with what is already installed (sparx
// persona issue 294). Each case below is one that stopped setup or left two
// designs in a business.

import { describe, expect, it } from 'vitest';
import { planTemplateInstall, type InstallSummary } from './template-plan';

function install(over: Partial<InstallSummary> = {}): InstallSummary {
  return { id: 'inst-a', blueprint_key: 'sparx', status: 'installed', sample_data: true, ...over };
}

const noRecord = { blueprintKey: null, installId: null };

describe('planTemplateInstall', () => {
  it('installs into a business with nothing installed', () => {
    expect(planTemplateInstall(noRecord, [], { key: 'sparx', sampleData: true })).toEqual({
      kind: 'install',
      remove: null,
    });
  });

  it('keeps an install the setup never made, when it is the same design and answer', () => {
    // A home workspace: the starter went in before its owner opened setup.
    expect(planTemplateInstall(noRecord, [install()], { key: 'sparx', sampleData: true })).toEqual({
      kind: 'keep',
      installId: 'inst-a',
    });
  });

  it('replaces that install when only the examples answer changes', () => {
    expect(planTemplateInstall(noRecord, [install()], { key: 'sparx', sampleData: false })).toEqual(
      { kind: 'install', remove: 'inst-a' }
    );
  });

  it('removes the setup’s own install when the design changes', () => {
    const state = { blueprintKey: 'sparx', installId: 'inst-a', sampleData: true };
    expect(planTemplateInstall(state, [install()], { key: 'salon', sampleData: true })).toEqual({
      kind: 'install',
      remove: 'inst-a',
    });
  });

  it('keeps the setup’s own install when the same design is chosen again', () => {
    const state = { blueprintKey: 'sparx', installId: 'inst-a', sampleData: true };
    expect(planTemplateInstall(state, [install()], { key: 'sparx', sampleData: true })).toEqual({
      kind: 'keep',
      installId: 'inst-a',
    });
  });

  it('leaves alone another design the setup did not make', () => {
    expect(
      planTemplateInstall(noRecord, [install({ blueprint_key: 'salon' })], {
        key: 'sparx',
        sampleData: true,
      })
    ).toEqual({ kind: 'install', remove: null });
  });

  it('removes a failed install of the same design before installing again', () => {
    expect(
      planTemplateInstall(noRecord, [install({ status: 'failed' })], {
        key: 'sparx',
        sampleData: true,
      })
    ).toEqual({ kind: 'install', remove: 'inst-a' });
  });
});
