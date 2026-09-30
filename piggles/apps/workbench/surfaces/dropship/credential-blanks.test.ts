// A box she clears stays cleared, unless nobody can see what is in it (889).
//
// The supplier form sent only the credential boxes that had something typed in
// them. That is right for exactly four fields in the whole vendor catalog - the
// API keys for Printify, Printful, DSers and Spocket - which are never shown
// back to her, so an empty one has to mean "leave the stored key alone".
//
// It is wrong for the other nineteen. A store id, a shop id, a feed address and
// fifteen spreadsheet COLUMN NAMES are all drawn in full on the form. Clearing
// one sent nothing, the API merged nothing over the stored bag, and the old
// value came straight back - under a toast reading "Supplier saved".
//
// Proved on the development database: emptying "Column: Cost price" on Highline
// Knitwear and pressing Save produced "Saved just now", and `wholesale_price`
// reappeared in the box. Nothing warned her. Nothing had changed.
//
// ── THE SAME SPLIT, ALREADY MADE, ON THE WAY OUT ────────────────────────────
//
// `nonSecretCredentials` in the REST route had already found this half of the
// round trip and says so: "'Credentials' is one bag and it was returned as one
// bag: nothing. That is right for the four `password` fields across the catalog
// and wrong for the other NINETEEN." The trip back was still one bag.
// [[feedback_a_fix_leaves_its_neighbour_behind]]

import { describe, expect, it } from 'vitest';
import {
  credentialIsMissing,
  credentialsToSend,
  missingRequiredCredential,
  type VendorCredentialField,
} from './dropship-data';

const field = (
  key: string,
  type: VendorCredentialField['type'],
  required = false
): VendorCredentialField => ({ key, label: key, type, required });

// The shape of the real CSV vendor: a feed address, four required column names,
// one optional one. No secrets at all.
const CSV_FIELDS: VendorCredentialField[] = [
  field('csvUrl', 'url', true),
  field('mapProductIdColumn', 'text', true),
  field('mapTitleColumn', 'text', true),
  field('mapSkuColumn', 'text', true),
  field('mapCostColumn', 'text', true),
  field('mapDescriptionColumn', 'text'),
];

// The shape of every API vendor: one secret, one plain id beside it.
const API_FIELDS: VendorCredentialField[] = [
  field('apiKey', 'password', true),
  field('shopId', 'text', true),
];

describe('credentialsToSend - what a blank box means', () => {
  it('sends a cleared column so it actually clears', () => {
    // THE DEFECT. She emptied the box on purpose and could read that it was
    // empty. Dropping it is the screen overruling her.
    const sent = credentialsToSend({ mapDescriptionColumn: '' }, CSV_FIELDS);
    expect(sent).toEqual({ mapDescriptionColumn: '' });
  });

  it('keeps a cleared secret, because she cannot see what is in it', () => {
    // The half that already worked and must not be traded away. A password box
    // is blank on every visit, so sending the blank would wipe a working
    // connection every time she edited the name.
    const sent = credentialsToSend({ apiKey: '' }, API_FIELDS);
    expect(sent).toEqual({});
  });

  it('tells the two apart in the same save', () => {
    const sent = credentialsToSend({ apiKey: '', shopId: '' }, API_FIELDS);
    expect(sent).toEqual({ shopId: '' });
  });

  it('sends everything she has typed, secret or not', () => {
    const sent = credentialsToSend({ apiKey: 'sk_new', shopId: '4821' }, API_FIELDS);
    expect(sent).toEqual({ apiKey: 'sk_new', shopId: '4821' });
  });

  it('treats a box of spaces as cleared', () => {
    // She pressed space. That is not a column name.
    expect(credentialsToSend({ mapSkuColumn: '   ' }, CSV_FIELDS)).toEqual({ mapSkuColumn: '   ' });
    expect(credentialsToSend({ apiKey: '   ' }, API_FIELDS)).toEqual({});
  });

  it('keeps a blank key it does not recognize', () => {
    // Fail towards not losing anything. A key this build cannot describe might
    // be a secret, and wiping something we cannot name is the worse mistake.
    expect(credentialsToSend({ somethingNew: '' }, CSV_FIELDS)).toEqual({});
  });

  it('sends nothing at all when she has touched nothing', () => {
    expect(credentialsToSend({}, CSV_FIELDS)).toEqual({});
  });
});

describe('missingRequiredCredential - an empty box that is needed', () => {
  it('catches a required column she cleared on an EXISTING supplier', () => {
    // THE OTHER HALF. This check used to run on new suppliers only, so a
    // required column could be emptied and saved. The sync then threw
    // "CSV column mapping is incomplete" before it ever fetched anything,
    // while the pane advised her to check the address and the permissions.
    const found = missingRequiredCredential({ mapCostColumn: '' }, CSV_FIELDS, false);
    expect(found?.key).toBe('mapCostColumn');
  });

  it('leaves an untouched box alone on an existing supplier', () => {
    // Why the check was new-only in the first place. On an edit the draft holds
    // only the boxes she has touched, so an ABSENT key means "unchanged" - and
    // reading absent as empty would have called every required field missing
    // the moment she opened the pane.
    expect(missingRequiredCredential({}, CSV_FIELDS, false)).toBeUndefined();
    expect(missingRequiredCredential({ name: 'x' }, CSV_FIELDS, false)).toBeUndefined();
  });

  it('catches a required box never filled in on a NEW supplier', () => {
    // On a new one every box starts empty, so absent IS empty.
    expect(missingRequiredCredential({}, CSV_FIELDS, true)?.key).toBe('csvUrl');
  });

  it('says nothing when every required box is filled', () => {
    const full = {
      csvUrl: 'https://example.test/feed.csv',
      mapProductIdColumn: 'style_code',
      mapTitleColumn: 'product_name',
      mapSkuColumn: 'sku',
      mapCostColumn: 'wholesale_price',
    };
    expect(missingRequiredCredential(full, CSV_FIELDS, true)).toBeUndefined();
    expect(missingRequiredCredential(full, CSV_FIELDS, false)).toBeUndefined();
  });

  it('does not complain about an OPTIONAL box she cleared', () => {
    // The two rules have to agree: clearing an optional column is allowed, and
    // `credentialsToSend` is the half that makes it stick.
    expect(
      missingRequiredCredential({ mapDescriptionColumn: '' }, CSV_FIELDS, false)
    ).toBeUndefined();
    expect(credentialsToSend({ mapDescriptionColumn: '' }, CSV_FIELDS)).toEqual({
      mapDescriptionColumn: '',
    });
  });

  it('never lets a required box be both clearable and unreported', () => {
    // The shape of the whole bug in one assertion. If a blank value is going to
    // be SENT for a field, and that field is required, the form owes her a
    // sentence about it before she presses Save.
    for (const f of [...CSV_FIELDS, ...API_FIELDS]) {
      const draft = { [f.key]: '' };
      const sent = credentialsToSend(draft, [...CSV_FIELDS, ...API_FIELDS]);
      if (!(f.key in sent) || !f.required) continue;
      expect(missingRequiredCredential(draft, [...CSV_FIELDS, ...API_FIELDS], false)?.key).toBe(
        f.key
      );
    }
  });
});

describe('credentialIsMissing - the rule the box and the bar share', () => {
  it('marks the box she cleared on an existing supplier', () => {
    const cost = CSV_FIELDS.find((f) => f.key === 'mapCostColumn')!;
    expect(credentialIsMissing({ mapCostColumn: '' }, cost, false)).toBe(true);
  });

  it('leaves every untouched box unmarked when the pane opens', () => {
    // The whole reason the old check was new-only. On an edit the draft is
    // empty until she types, and marking all five required boxes red the moment
    // she opened the pane would be worse than the bug.
    for (const f of CSV_FIELDS) {
      expect(credentialIsMissing({}, f, false)).toBe(false);
    }
  });

  it('agrees with the bar about which box is at fault', () => {
    // They are drawn by different components and must never disagree: the bar
    // names a box, and that box has to be the one wearing the error.
    const draft = { mapSkuColumn: '', mapCostColumn: '' };
    const first = missingRequiredCredential(draft, CSV_FIELDS, false);
    expect(first?.key).toBe('mapSkuColumn');
    expect(credentialIsMissing(draft, first!, false)).toBe(true);
  });
});
