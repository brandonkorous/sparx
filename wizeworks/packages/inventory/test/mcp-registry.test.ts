// Structural guard over the inventory MCP surface (docs/146 Phase 12).
//
// Phase 12 is called "prove it", and the thing most worth proving about a tool
// registry is not that any one tool works — the services underneath have their
// own suites — but that the SET stays coherent as it grows. Every failure below
// is one that typechecks perfectly and only shows up in front of a customer's
// assistant:
//
//  - two tools with the same name: the second silently shadows the first, and
//    which one wins depends on array order in a barrel file nobody reads;
//  - a write tool with `confirmation: false`: the MCP server decides whether to
//    prompt from that flag alone, so a mislabelled tool mutates a tenant's stock
//    with no one asked;
//  - a thin or missing description: the model picks tools by description, so a
//    vague one is not a cosmetic problem — it is the tool never being chosen, or
//    being chosen for the wrong question.
//
// This is the whole registry, not just the tools Phase 12 added: the point is
// that the NEXT phase cannot quietly break it either.

import { describe, expect, it } from 'vitest';

import { inventoryMcpTools } from '../src/mcp';

describe('inventory MCP registry', () => {
  it('publishes a non-trivial tool set', () => {
    expect(inventoryMcpTools.length).toBeGreaterThan(100);
  });

  it('has no duplicate tool names', () => {
    const seen = new Map<string, number>();
    for (const tool of inventoryMcpTools) {
      seen.set(tool.name, (seen.get(tool.name) ?? 0) + 1);
    }
    const duplicates = [...seen.entries()].filter(([, count]) => count > 1).map(([name]) => name);
    expect(duplicates).toEqual([]);
  });

  it('names every tool in snake_case', () => {
    // The wire format an assistant sees. A camelCase name is not wrong so much
    // as inconsistent, and an inconsistent vocabulary is one the model has to
    // guess at.
    const wrong = inventoryMcpTools.filter((tool) => !/^[a-z][a-z0-9_]*$/.test(tool.name));
    expect(wrong.map((tool) => tool.name)).toEqual([]);
  });

  /**
   * The scanner is the one place a prompt would break the tool.
   *
   * These are single trigger pulls on a warehouse floor — two hundred an hour —
   * and each one is either STAGED into a session that `post_scanned_receipt`
   * commits (and that tool does prompt), or a shelf-to-shelf move that leaves
   * the location total untouched. Each also carries a caller-supplied scan id,
   * so a retry applies once. Prompting per scan would not make them safer; it
   * would make people stop using them and type the numbers in later.
   *
   * The list is spelled out rather than pattern-matched on `scan_`: a future
   * `scan_to_write_off` should have to be added here deliberately, in front of
   * somebody, rather than inheriting the exemption from its name.
   */
  const UNPROMPTED_WRITES = new Set([
    'register_barcode',
    'scan_to_receive',
    'scan_to_count',
    'scan_to_transfer',
    'scan_put_away',
  ]);

  it('requires confirmation on every write tool except the documented scanner set', () => {
    const unguarded = inventoryMcpTools.filter(
      (tool) =>
        tool.scope === 'write:inventory' && !tool.confirmation && !UNPROMPTED_WRITES.has(tool.name)
    );
    expect(unguarded.map((tool) => tool.name)).toEqual([]);
  });

  it('keeps the unprompted set from growing silently', () => {
    // If one of these gains a prompt, delete it from the set — do not leave a
    // stale exemption sitting where the next person reads it as a rule.
    const stale = [...UNPROMPTED_WRITES].filter((name) => {
      const tool = inventoryMcpTools.find((candidate) => candidate.name === name);
      return tool === undefined || tool.confirmation;
    });
    expect(stale).toEqual([]);
  });

  it('still prompts on the tool that COMMITS a scanning session', () => {
    // The exemption above is only honest while the commit step is guarded.
    const post = inventoryMcpTools.find((tool) => tool.name === 'post_scanned_receipt');
    expect(post?.confirmation).toBe(true);
  });

  it('never asks for confirmation on a read tool', () => {
    // The mirror of the rule above, and it matters for a different reason: a
    // read that prompts trains people to click through prompts.
    const noisy = inventoryMcpTools.filter(
      (tool) => tool.scope === 'read:inventory' && tool.confirmation
    );
    expect(noisy.map((tool) => tool.name)).toEqual([]);
  });

  it('gives every tool a description long enough to choose it by', () => {
    const thin = inventoryMcpTools.filter((tool) => (tool.description ?? '').trim().length < 60);
    expect(thin.map((tool) => tool.name)).toEqual([]);
  });

  it('gives every tool an input schema', () => {
    const missing = inventoryMcpTools.filter((tool) => typeof tool.input?.safeParse !== 'function');
    expect(missing.map((tool) => tool.name)).toEqual([]);
  });

  it('uses only the inventory scopes', () => {
    const scopes = new Set(inventoryMcpTools.map((tool) => tool.scope));
    expect([...scopes].sort()).toEqual(['read:inventory', 'write:inventory']);
  });

  describe('phase 8-11 coverage (docs/146 §6 items 12.1, 12.2)', () => {
    const names = new Set(inventoryMcpTools.map((tool) => tool.name));

    // 12.2 names these four explicitly. They are the questions an operator
    // actually asks, as opposed to the tables the schema happens to have.
    it.each([
      'explain_stock_level',
      'get_stockout_risk',
      'get_supplier_performance',
      'get_inventory_health',
    ])('publishes the operator question tool %s', (name) => {
      expect(names.has(name)).toBe(true);
    });

    // 12.1: each of these was a phase that shipped a service, a REST route and a
    // workbench surface, and had no way in from an assistant.
    it.each([
      ['phase 8 — supplier scorecards', 'list_supplier_scorecards'],
      ['phase 8 — quantity price breaks', 'get_supplier_price_ladder'],
      ['phase 8 — the approval queue', 'list_purchase_order_approvals'],
      ['phase 8 — what is on its way', 'list_advance_ship_notices'],
      ['phase 8 — credits not yet received', 'list_supplier_returns'],
      ['phase 9 — what we owe customers', 'list_backorders'],
      ['phase 9 — commitments against one item', 'get_variant_commitments'],
      ['phase 9 — consignment settlements', 'list_consignment_settlements'],
      ['phase 9 — stock we do not own', 'list_non_owned_stock'],
      ['phase 9 — batches running out of time', 'list_expiring_stock'],
      ['phase 10 — the report catalog', 'list_inventory_reports'],
      ['phase 10 — running any report', 'run_inventory_report'],
      ['phase 10 — stock against the accounts', 'get_gl_reconciliation'],
    ])('covers %s', (_label, name) => {
      expect(names.has(name)).toBe(true);
    });

    // The exclusions are decisions, not omissions, so they are asserted too — a
    // later phase adding one of these should have to delete a line here and read
    // why it was absent.
    it.each([
      'decide_purchase_order_approval',
      'set_supplier_price_breaks',
      'send_supplier_return',
      'cancel_backorder',
      'set_stock_ownership',
      'write_off_expiring_lot',
      'create_report_schedule',
      'apply_stock_import',
    ])('deliberately does NOT publish %s', (name) => {
      expect(names.has(name)).toBe(false);
    });
  });
});
