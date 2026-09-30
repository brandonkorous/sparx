// What deleting a way of filing says it destroys (issue 385).
//
// A vocabulary is shared across a business's sites; its labels are not. The
// delete cascades to every site's labels at once, so the warning has to count
// all of them, not the ones on the site the owner happens to be standing in.

import { describe, expect, it } from 'vitest';

import { taxonomyDeleteWarning } from './taxonomy-data';

describe('taxonomyDeleteWarning', () => {
  it('names the labels on other sites when this site holds none of them', () => {
    const text = taxonomyDeleteWarning({ term_count: 0, all_sites_term_count: 20 });
    expect(text).toContain('all 20 of its labels');
    expect(text).toContain('20 of them are on your other sites');
  });

  it('counts every site, not only this one, when both hold labels', () => {
    const text = taxonomyDeleteWarning({ term_count: 5, all_sites_term_count: 13 });
    expect(text).toContain('all 13 of its labels');
    expect(text).toContain('8 of them are on your other sites');
  });

  it('uses the singular for one label elsewhere', () => {
    expect(taxonomyDeleteWarning({ term_count: 2, all_sites_term_count: 3 })).toContain(
      '1 of them is on your other sites'
    );
  });

  it('does not mention other sites when every label is here', () => {
    const text = taxonomyDeleteWarning({ term_count: 4, all_sites_term_count: 4 });
    expect(text).toContain('all 4 of its labels');
    expect(text).not.toContain('other sites');
  });

  it('says there is nothing inside when there are no labels anywhere', () => {
    expect(taxonomyDeleteWarning({ term_count: 0, all_sites_term_count: 0 })).not.toContain(
      'labels'
    );
  });
});
