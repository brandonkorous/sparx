// A ready-made report counts what its own words say (sparx persona issue 250).
//
// "Where your deals are" said "open deals" and counted a lost one; "Who is
// carrying what" said "still to do" and counted canceled tasks; "Requests by
// urgency" said "nobody has answered yet" over requests that had been answered.

import { describe, expect, it } from 'vitest';

import { BUILTIN_REPORTS } from './report-builtins';
import { compileReport, type ReportDefinition } from './report-compiler';

const bySlug = (slug: string) => {
  const report = BUILTIN_REPORTS.find((r) => r.slug === slug);
  if (!report) throw new Error(`no built-in ${slug}`);
  return report;
};

describe('the ready-made reports', () => {
  it('count only open deals where they say open deals', () => {
    const report = bySlug('deals-by-stage');
    expect(report.description).toContain('open deals');
    expect(report.filters).toEqual({
      logic: 'AND',
      conditions: [{ field: 'closedAt', operator: 'is_not_set' }],
    });
  });

  it('count only open tasks as still to do, not canceled ones', () => {
    expect(bySlug('open-tasks-by-owner').filters).toEqual({
      logic: 'AND',
      conditions: [{ field: 'status', operator: 'eq', value: 'open' }],
    });
  });

  it('say "not sorted" for requests that are only not sorted', () => {
    const report = bySlug('requests-by-urgency');
    expect(report.filters).toEqual({
      logic: 'AND',
      conditions: [{ field: 'resolvedAt', operator: 'is_not_set' }],
    });
    expect(report.description).not.toContain('answered');
  });

  it('every one of them compiles, filters included', () => {
    for (const report of BUILTIN_REPORTS) {
      expect(() => compileReport(report as unknown as ReportDefinition, 10)).not.toThrow();
    }
  });
});
