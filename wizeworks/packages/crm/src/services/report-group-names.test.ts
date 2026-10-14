// A report grouped by an id names each group (sparx persona issue 247).
//
// The compiler reads one table with no joins, so a breakdown by stage, owner or
// company came back as raw ids: "Where your deals are", a report sparx ships,
// drew bars labeled `d516b43-95d3-…`. Every id field now says where its name
// lives, and the run looks the names up after the rows are in.

import { describe, expect, it } from 'vitest';

import {
  compileReport,
  groupNamesSql,
  reportableFields,
  reportableObjects,
} from './report-compiler';

const base = {
  filters: { logic: 'AND' as const, conditions: [] },
  measures: [{ fn: 'count' as const }],
  dateRange: { kind: 'all' as const },
};

describe('a breakdown by an id', () => {
  it('knows where to find a name for every id a report can group by', () => {
    const nameless: string[] = [];
    for (const { objectKey } of reportableObjects()) {
      for (const field of reportableFields(objectKey)) {
        if (field.kind !== 'uuid') continue;
        const compiled = compileReport({ ...base, objectKey, groupBy: { field: field.path } }, 10);
        if (!compiled.groupNames) nameless.push(`${objectKey}.${field.path}`);
      }
    }
    expect(nameless).toEqual([]);
  });

  it('looks the names up by bound ids, from a table the compiler names', () => {
    const compiled = compileReport(
      { ...base, objectKey: 'deal', groupBy: { field: 'stageId' } },
      10
    );
    expect(compiled.groupNames).toBeDefined();
    const sql = groupNamesSql(compiled.groupNames!);
    expect(sql).toContain('FROM "pipeline_stages"');
    expect(sql).toContain('WHERE "id" = ANY($1::uuid[])');
  });

  it('leaves a coded value and a date alone: those are not ids', () => {
    const coded = compileReport(
      { ...base, objectKey: 'contact', groupBy: { field: 'lifecycleStage' } },
      10
    );
    const dated = compileReport(
      { ...base, objectKey: 'contact', groupBy: { field: 'createdAt', bucket: 'month' } },
      10
    );
    expect(coded.groupNames).toBeUndefined();
    expect(dated.groupNames).toBeUndefined();
  });
});
