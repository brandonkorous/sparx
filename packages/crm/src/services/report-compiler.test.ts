// The report compiler (docs/144 §8).
//
// Pure — no database. What matters here is the SHAPE of the SQL the compiler
// emits, and above all what it refuses to emit: a tenant's saved definition
// names an object and some property paths, so the identifier allowlist is the
// only thing standing between a stored string and a statement.

import { describe, expect, it } from 'vitest';

import {
  compileReport,
  measureLabel,
  reportableFields,
  reportableObjects,
} from './report-compiler';
import { CrmValidationError } from '../errors';

const NO_FILTER = { logic: 'AND' as const, conditions: [] };

const base = {
  objectKey: 'contact',
  filters: NO_FILTER,
  groupBy: null,
  measures: [{ fn: 'count' as const }],
  dateRange: { kind: 'all' as const },
};

describe('what can be reported on', () => {
  it('offers only objects the compiler can actually query', () => {
    const keys = reportableObjects().map((o) => o.objectKey);
    expect(keys).toContain('contact');
    expect(keys).toContain('deal');
    expect(keys).toContain('ticket');
    // The builder's field picker is fed from exactly this, so anything listed
    // here must compile — that is the invariant, not the specific list.
    for (const key of keys) {
      for (const field of reportableFields(key)) {
        expect(() =>
          compileReport({ ...base, objectKey: key, groupBy: { field: field.path } }, 10)
        ).not.toThrow();
      }
    }
  });
});

describe('identifiers are an allowlist, not interpolation', () => {
  it('refuses a field that is not on the object', () => {
    expect(() => compileReport({ ...base, groupBy: { field: 'password_hash' } }, 10)).toThrow(
      CrmValidationError
    );
  });

  it('refuses a quoted-out custom-property path', () => {
    // The failure this guards: a `custom.` key is spliced into a JSONB
    // extraction, so a key carrying a quote would escape the bag and land in
    // the statement. The key rule is what stops it.
    expect(() =>
      compileReport({ ...base, groupBy: { field: "custom.x' || (SELECT 1) || '" } }, 10)
    ).toThrow(CrmValidationError);
  });

  it('accepts a well-formed custom property as a JSONB extraction', () => {
    const compiled = compileReport({ ...base, groupBy: { field: 'custom.warranty_tier' } }, 10);
    expect(compiled.sql).toContain(`"custom_properties" ->> 'warranty_tier'`);
  });

  it('refuses an unknown object', () => {
    expect(() => compileReport({ ...base, objectKey: 'pg_user' }, 10)).toThrow(CrmValidationError);
  });
});

describe('values are bound, never inlined', () => {
  it('binds a filter value as a parameter', () => {
    const compiled = compileReport(
      {
        ...base,
        filters: {
          logic: 'AND',
          conditions: [{ field: 'company', operator: 'eq', value: "US' OR 1=1 --" }],
        },
      },
      10
    );
    // The hostile string is DATA. It appears in params and nowhere in the text.
    expect(compiled.sql).not.toContain('OR 1=1');
    expect(compiled.params).toContain("US' OR 1=1 --");
  });

  it('always ends with a bound limit', () => {
    const compiled = compileReport(base, 25);
    expect(compiled.sql).toMatch(/LIMIT \$\d+$/);
    expect(compiled.params.at(-1)).toBe(25);
  });
});

describe('the arithmetic a report is allowed to do', () => {
  it('refuses to add up something that is not a number', () => {
    // Casting would return a number that looks authoritative and is wrong the
    // moment one row holds "n/a".
    expect(() =>
      compileReport({ ...base, measures: [{ fn: 'sum', field: 'company' }] }, 10)
    ).toThrow(CrmValidationError);
  });

  it('adds up a currency column', () => {
    const compiled = compileReport({ ...base, measures: [{ fn: 'sum', field: 'totalSpent' }] }, 10);
    expect(compiled.sql).toContain('SUM("total_spent")');
  });

  it('counts without needing a field', () => {
    expect(compileReport(base, 10).sql).toContain('COUNT(*)');
  });
});

describe('grouping', () => {
  it('buckets a date rather than grouping it raw', () => {
    // Raw, a timestamp column produces one row per instant — thousands of rows
    // of 1, which is a list, not a breakdown.
    const compiled = compileReport(
      { ...base, groupBy: { field: 'createdAt', bucket: 'month' } },
      10
    );
    expect(compiled.sql).toContain(`DATE_TRUNC('month', "created_at")`);
  });

  it('defaults an unbucketed date to months instead of erroring', () => {
    const compiled = compileReport({ ...base, groupBy: { field: 'createdAt' } }, 10);
    expect(compiled.sql).toContain(`DATE_TRUNC('month'`);
  });

  it('refuses a bucket on something that is not a date', () => {
    expect(() =>
      compileReport({ ...base, groupBy: { field: 'company', bucket: 'month' } }, 10)
    ).toThrow(CrmValidationError);
  });

  it('reads time forwards and everything else biggest-first', () => {
    expect(compileReport({ ...base, groupBy: { field: 'createdAt' } }, 10).sql).toContain(
      'ORDER BY 1 ASC'
    );
    expect(compileReport({ ...base, groupBy: { field: 'company' } }, 10).sql).toContain(
      'ORDER BY 2 DESC'
    );
  });
});

describe('the clauses that are always there', () => {
  it('excludes soft-deleted rows', () => {
    expect(compileReport(base, 10).sql).toContain(`"deleted_at" IS NULL`);
  });

  it('includes tenant-wide rows in a site-scoped report', () => {
    // Excluding them would make a two-site business's numbers not add up: a
    // record that belongs to no single site belongs to the whole business.
    const compiled = compileReport({ ...base, propertyId: 'site-1' }, 10);
    expect(compiled.sql).toContain('"property_id" IS NULL');
    expect(compiled.params).toContain('site-1');
  });

  it('treats "not equal to" the way a person means it', () => {
    // A bare <> drops every NULL row and quietly under-reports.
    const compiled = compileReport(
      {
        ...base,
        filters: { logic: 'AND', conditions: [{ field: 'company', operator: 'neq', value: 'US' }] },
      },
      10
    );
    expect(compiled.sql).toContain('IS NULL OR');
  });

  it('turns an empty filter into a no-op rather than a missing WHERE', () => {
    expect(compileReport(base, 10).sql).toContain('WHERE');
  });
});

describe('the words on the columns', () => {
  it('names a count after the records being counted', () => {
    expect(measureLabel('contact', { fn: 'count' })).toBe('How many customers');
  });

  it('uses the author’s own label when they gave one', () => {
    expect(measureLabel('contact', { fn: 'count', label: 'Signups' })).toBe('Signups');
  });

  it('describes a sum in plain words', () => {
    expect(measureLabel('contact', { fn: 'sum', field: 'totalSpent' })).toBe(
      'Total lifetime spend'
    );
  });
});
