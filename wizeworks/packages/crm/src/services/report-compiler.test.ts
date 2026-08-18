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

  it('accepts a camelCase custom property, which is the shape the editor makes', () => {
    // The key rule here must MATCH @wizeworks/field-schema's, not merely be stricter
    // than it. It was lowercase-only while field keys have always been
    // camelCase, so a property called `renewalMonth` — picked out of the
    // builder's own field list — answered "there is no field called that".
    const compiled = compileReport({ ...base, groupBy: { field: 'custom.renewalMonth' } }, 10);
    expect(compiled.sql).toContain(`"custom_properties" ->> 'renewalMonth'`);
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

describe('objects a tenant invented', () => {
  // Every custom object shares `crm_records`, so the object is a WHERE predicate
  // rather than a table name. That predicate is the ONE varying part of a
  // source, and these tests exist to keep it a bound value.
  const course = {
    ...base,
    objectKey: 'course',
    properties: { object: { label: 'Course', labelPlural: 'Courses' } },
  };

  it('still refuses an unknown key rather than answering with zero rows', () => {
    // Without a spec the compiler has no evidence the object exists — and a typo
    // answered by an empty table is worse than a typo answered by a sentence.
    expect(() => compileReport({ ...base, objectKey: 'course' }, 10)).toThrow(CrmValidationError);
  });

  it('narrows the shared table with a BOUND object key', () => {
    const compiled = compileReport(course, 10);
    expect(compiled.sql).toContain('FROM "crm_records"');
    expect(compiled.sql).toContain('"object_key" = $1');
    expect(compiled.sql).not.toContain('course');
    expect(compiled.params).toContain('course');
  });

  it('refuses an object key that is not snake_case', () => {
    expect(() =>
      compileReport({ ...course, objectKey: 'crm_records"; DROP TABLE x --' }, 10)
    ).toThrow(CrmValidationError);
  });

  it('reads a declared property out of the values bag', () => {
    const compiled = compileReport({ ...course, groupBy: { field: 'custom.level' } }, 10);
    expect(compiled.sql).toContain(`"values" ->> 'level'`);
  });

  it('names a count after what the tenant calls the object', () => {
    expect(measureLabel('course', { fn: 'count' }, course.properties)).toBe('How many courses');
  });

  it('uses the tenant’s own words for a property, not the raw key', () => {
    const compiled = compileReport(
      {
        ...course,
        properties: {
          ...course.properties,
          fields: { seatsLeft: { label: 'Seats left', kind: 'number' as const } },
        },
        groupBy: { field: 'custom.seatsLeft' },
      },
      10
    );
    expect(compiled.columns[0]?.label).toBe('Seats left');
  });
});

describe('declared properties are read as the type they were declared', () => {
  // The alternative — everything out of the bag as text — is what made a Yes/No
  // field filterable only with a text box, and a price impossible to add up.
  const withField = (kind: 'number' | 'currency' | 'boolean' | 'date') => ({
    ...base,
    properties: { fields: { thing: { label: 'Thing', kind } } },
  });

  it('adds up money, taking the amount out of its {amount, currency} shape', () => {
    const compiled = compileReport(
      { ...withField('currency'), measures: [{ fn: 'sum', field: 'custom.thing' }] },
      10
    );
    expect(compiled.sql).toContain(`-> 'thing' ->> 'amount'`);
    expect(compiled.sql).toContain('SUM(');
  });

  it('buckets a declared date by month like any other date', () => {
    const compiled = compileReport(
      { ...withField('date'), groupBy: { field: 'custom.thing', bucket: 'month' } },
      10
    );
    expect(compiled.sql).toContain(`DATE_TRUNC('month'`);
  });

  it('still refuses to add up a text property', () => {
    expect(() =>
      compileReport({ ...base, measures: [{ fn: 'sum', field: 'custom.notes' }] }, 10)
    ).toThrow(CrmValidationError);
  });

  it('GUARDS every cast, so one wrong-typed row cannot fail the whole report', () => {
    // Postgres has no try_cast, and a bare ::numeric throws for the entire query
    // the first time a row holds something else — which rows predating a field's
    // type change do. The guard makes those rows read as unset instead.
    for (const kind of ['number', 'currency', 'boolean'] as const) {
      expect(
        compileReport({ ...withField(kind), groupBy: { field: 'custom.thing' } }, 10).sql
      ).toContain('jsonb_typeof');
    }
    expect(
      compileReport({ ...withField('date'), groupBy: { field: 'custom.thing' } }, 10).sql
    ).toContain('CASE WHEN');
  });
});

describe('site scoping applies only where a site column exists', () => {
  it('omits it on a company, which is a tenant-level record', () => {
    // `companies` has no property_id — the same firm trades with every site a
    // business runs. Writing the clause anyway would name a column that does not
    // exist and fail at run time with a Postgres error.
    const compiled = compileReport({ ...base, objectKey: 'company', propertyId: 'site-1' }, 10);
    expect(compiled.sql).not.toContain('property_id');
    expect(compiled.params).not.toContain('site-1');
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
