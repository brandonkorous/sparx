import { describe, expect, it } from 'vitest';

import { announceable, type ActivityItem } from './activity';

// The status bar interrupts for things that happen TO the business. An owner
// who types in a customer was told twice: once by the pane, once by a toast
// (sparx persona issue 078).
function item(id: string, actorId: string | null): ActivityItem {
  return {
    id,
    at: '2026-10-02T17:00:00.000Z',
    action: 'crm.customer.created',
    module: 'crm',
    title: 'Customer created',
    subject: 'Renée Castañeda',
    entityType: 'Customer',
    entityId: id,
    actor: { id: actorId, type: actorId ? 'user' : 'system', name: null },
  };
}

describe('which fresh events earn a toast', () => {
  it('skips what the viewer did themselves', () => {
    expect(announceable([item('a', 'doty'), item('b', 'kendra')], 'doty').map((i) => i.id)).toEqual(
      ['b']
    );
  });

  it('announces what a form or the system did', () => {
    expect(announceable([item('a', null)], 'doty')).toHaveLength(1);
  });

  it('announces everything while the viewer is not known yet', () => {
    expect(announceable([item('a', 'doty')], undefined)).toHaveLength(1);
  });
});
