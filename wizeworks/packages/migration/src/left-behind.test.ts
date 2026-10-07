// What a file leaves behind, in words its owner knows.
//
// MEASURED 2026-10-06 on Gillett's Shopify customer export (30 customers): the
// report said "3 columns in this file have no home here and will be left
// behind: accepts_sms, total_orders, total_spent". Those are sparx's keys, not
// his columns, and Shopify's "Tax Exempt" column, read by nothing, was not in
// the list at all: three exempt farms would have come over with no sign of it
// (sparx persona issue 104).

import { describe, expect, it } from 'vitest';

import { readSource } from './detect';
import { leftBehind } from './validate';

const HEADER =
  'Customer ID,First Name,Last Name,Email,Accepts Email Marketing,Default Address Company,Default Address Address1,Default Address Address2,Default Address City,Default Address Province Code,Default Address Country Code,Default Address Zip,Default Address Phone,Phone,Accepts SMS Marketing,Total Spent,Total Orders,Note,Tax Exempt,Tags';

const FILE = [
  HEADER,
  '\'7210448301122,Teodoro,Villaseñor,teo.villasenor@elkomail.test,no,Villaseñor Ranch,HC 31 Box 4500,,Elko,NV,US,89801,(775) 555-0154,(775) 555-0154,no,7790.44,6,Cattle ranch.,yes,"retail, ag-exempt"',
  "'7210448301123,Hollis,Pettibone,hollis.pettibone@ogdenmail.test,yes,,3910 Harrison Blvd,,Ogden,UT,US,84403,(801) 555-0188,(801) 555-0188,no,154.29,2,,no,retail",
].join('\n');

function customers() {
  const result = readSource({ text: FILE, fileName: 'customers_export.csv' });
  const entity = result.entities.find((e) => e.entity === 'customers');
  if (!entity) throw new Error('no customers read');
  return entity;
}

describe('what a customer file leaves behind', () => {
  it("names it in the file's own words and plain words, never sparx's keys", () => {
    const behind = leftBehind(customers().report);
    expect(behind).toEqual(
      expect.arrayContaining(['SMS opt-in', 'Total spent', 'Number of orders', 'Customer ID'])
    );
    expect(behind.join(' ')).not.toMatch(/_/);
  });

  it('names a column nothing read', () => {
    expect(customers().report.unreadColumns).toEqual(['Customer ID']);
  });

  it("carries Shopify's tax exemption onto the note, saying what to do", () => {
    const [teodoro, hollis] = customers().rows;
    expect(teodoro?.note).toBe(
      'Cattle ranch.\n\nTax exempt in Shopify. Add their exemption certificate under Tax exemption to stop charging them tax.'
    );
    expect(hollis?.note).toBeUndefined();
  });
});

// MEASURED 2026-10-06 on Gillett's own Shopify stock export: 1,366 rows read,
// 0 ready, 1,367 problems, because Shopify names the columns "On hand
// (current)" and "Available (not editable)". The two rows for the Bosch Fuel
// Rail, whose SKU is "-", were dropped with their 5 units and no word
// (sparx persona issue 105).
const STOCK = [
  'Handle,Title,Option1 Name,Option1 Value,SKU,HS Code,COO,Location,Bin name,Incoming (not editable),Unavailable (not editable),Committed (not editable),Available (not editable),On hand (current),On hand (new)',
  'bosch-injector,Bosch Remanufactured Fuel Injector (0986435621),Title,Default Title,0986435621,,,Warehouse (Concord Park),,0,0,0,8,8,',
  'bosch-injector,Bosch Remanufactured Fuel Injector (0986435621),Title,Default Title,0986435621,,,Main Office & Shop (Heritage Crest),,0,0,0,2,2,5',
  'bosch-0445226014-fuel-rail,Bosch Fuel Rail (0445226014),Title,Default Title,-,,,Warehouse (Concord Park),,0,0,0,3,3,',
].join('\n');

describe("Shopify's own stock export", () => {
  function stock() {
    const entity = readSource({ text: STOCK, fileName: 'inventory_export.csv' }).entities[0];
    if (!entity) throw new Error('no stock read');
    return entity;
  }

  it('reads the on-hand count, and a typed new count over the current one', () => {
    expect(stock().rows.map((r) => r.quantity)).toEqual(['8', '5', '3']);
  });

  it('names a row with no SKU as a problem instead of dropping it', () => {
    const { report } = stock();
    expect(report.okCount).toBe(2);
    expect(report.issues.map((i) => [i.rowIndex, i.message])).toEqual([
      [2, 'This stock level has no SKU.'],
    ]);
  });

  it('does not call the columns that name the item left behind', () => {
    const behind = leftBehind(stock().report);
    expect(behind).not.toContain('Handle');
    expect(behind).not.toContain('Title');
    expect(behind).not.toContain('On hand (current)');
  });
});
