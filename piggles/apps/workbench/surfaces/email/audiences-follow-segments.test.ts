import { describe, expect, it } from 'vitest';
import { segmentKeys } from '../crm/segments-data';
import { emailKeys } from './broadcasts-data';

/**
 * The composer's audiences are the CRM's segments, so they sit under the
 * segments' query key: saving a segment refreshes every list of segments,
 * and an audience made beside an open composer shows in its dropdown at once
 * (sparx persona issue 151). Under its own `['email', 'audiences']` key it
 * stayed out of the dropdown until the composer was opened again.
 */
describe('the audience list', () => {
  it('is refreshed whenever a segment is saved', () => {
    expect(emailKeys.audiences.slice(0, segmentKeys.all.length)).toEqual([...segmentKeys.all]);
  });
});
