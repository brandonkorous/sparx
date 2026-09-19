// SIX PAGES CALLED CONTACT, ONE PER SITE.
//
// The where-used scan is tenant-wide because a saved piece is. The rows it
// returns are pages, which are not. Without the site on the row the list is six
// identical lines, and clicking the wrong one tells the owner her page has been
// deleted.

import { describe, expect, it } from 'vitest';

import {
  isElsewhere,
  namesSites,
  sharedLibraryNote,
  switchAsk,
  type Placement,
} from './saved-piece-usage-words';

const HERE = 'site-juniper-row';
const THERE = 'site-archive';

const contact = (siteId: string, siteName: string): Placement => ({
  id: `page-${siteId}`,
  name: 'Contact',
  siteId,
  siteName,
});

const here = contact(HERE, 'Juniper Row');
const there = contact(THERE, 'Juniper Row Archive');

describe('when every placement is on the site she is in', () => {
  it('says nothing, because the site adds no information', () => {
    expect(namesSites([here], HERE)).toBe(false);
    expect(namesSites([here, contact(HERE, 'Juniper Row')], HERE)).toBe(false);
  });

  it('says nothing for an empty list', () => {
    expect(namesSites([], HERE)).toBe(false);
  });
});

describe('when a placement is somewhere else', () => {
  it('names the sites', () => {
    expect(namesSites([there], HERE)).toBe(true);
  });

  it('names them for a list that spans two sites', () => {
    // The case the whole thing exists for: two rows both reading "Contact".
    expect(namesSites([here, there], HERE)).toBe(true);
  });
});

describe('before the shell knows which site she is in', () => {
  it('does not guess that one site is elsewhere', () => {
    // A claim that flickers on and then off is worse than a beat of silence.
    expect(namesSites([here], null)).toBe(false);
    expect(isElsewhere(here, null)).toBe(false);
    expect(isElsewhere(there, null)).toBe(false);
  });

  it('still names them when the rows disagree among themselves', () => {
    // This is true wherever the reader is standing, so not knowing does not
    // stop it being said.
    expect(namesSites([here, there], null)).toBe(true);
  });
});

describe('opening a row', () => {
  it('knows which ones leave this site', () => {
    expect(isElsewhere(here, HERE)).toBe(false);
    expect(isElsewhere(there, HERE)).toBe(true);
  });

  it('asks in terms of the page and the site, never an id', () => {
    const ask = switchAsk(there);
    expect(ask.title).toContain('Contact');
    expect(ask.title).toContain('Juniper Row Archive');
    expect(ask.description).toContain('unsaved edits');
    expect(`${ask.title} ${ask.description}`).not.toContain(THERE);
  });
});

describe('saying the library is shared', () => {
  it('says it to an owner who runs more than one site', () => {
    expect(sharedLibraryNote(7)).toContain('any of your sites');
    expect(sharedLibraryNote(2)).not.toBe(null);
  });

  it('says nothing to an owner who runs one', () => {
    // A caveat that never applies is noise, and noise is how a real caveat stops
    // being read.
    expect(sharedLibraryNote(1)).toBe(null);
    expect(sharedLibraryNote(0)).toBe(null);
  });
});
