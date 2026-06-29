import { fmtMoneyCents } from './format';
import type { ActionItem, ActionSeverity, Raw } from './types';

// "Needs attention" — the highest-leverage section, rendered ABOVE the KPIs when
// non-empty and collapsed entirely when clean (research §1). Each item is a
// count + a one-click deep link to where you fix it, sorted danger → warning →
// info. Built from the same fail-soft reads; a disabled module contributes
// nothing.

const RANK: Record<ActionSeverity, number> = { danger: 0, warning: 1, info: 2 };

export function buildAlerts(raw: Raw, m: ReadonlySet<string>): ActionItem[] {
  const has = (mod: string) => m.has(mod);
  const out: ActionItem[] = [];

  // Inventory: low / out of stock.
  if (has('inventory') && raw.inventory) {
    const { lowStock, outOfStock } = raw.inventory.stockStatus;
    const total = lowStock + outOfStock;
    if (total > 0) {
      out.push({
        key: 'stock',
        severity: outOfStock > 0 ? 'danger' : 'warning',
        title: `${total} item${total === 1 ? '' : 's'} low or out of stock`,
        hint: outOfStock > 0 ? `${outOfStock} out of stock` : 'Below reorder point',
        href: '/inventory/stock',
        module: 'inventory',
        icon: 'stock',
      });
    }
  }

  // Invoicing: overdue receivables.
  if (has('invoicing') && raw.collections && raw.collections.openBalance.overdueCount > 0) {
    const ob = raw.collections.openBalance;
    out.push({
      key: 'overdue-ar',
      severity: 'danger',
      title: `${ob.overdueCount} overdue invoice${ob.overdueCount === 1 ? '' : 's'}`,
      hint: `${fmtMoneyCents(ob.overdueCents)} past due`,
      href: '/invoicing/documents',
      module: 'invoicing',
      icon: 'invoice',
    });
  }

  // Commerce: abandoned carts with recoverable revenue.
  if (has('commerce') && raw.abandoned && raw.abandoned.abandonedCount > 0) {
    out.push({
      key: 'abandoned',
      severity: 'warning',
      title: `${raw.abandoned.abandonedCount} abandoned cart${raw.abandoned.abandonedCount === 1 ? '' : 's'}`,
      hint: `${fmtMoneyCents(raw.abandoned.recoveredRevenueCents)} recoverable`,
      href: '/commerce/carts',
      module: 'commerce',
      icon: 'cart',
    });
  }

  // B2B: approvals waiting + accounts on credit hold.
  if (has('b2b') && raw.b2b) {
    if (raw.b2b.approvalQueue > 0) {
      out.push({
        key: 'b2b-approvals',
        severity: 'warning',
        title: `${raw.b2b.approvalQueue} order${raw.b2b.approvalQueue === 1 ? '' : 's'} awaiting approval`,
        href: '/b2b/approval-queue',
        module: 'b2b',
        icon: 'approval',
      });
    }
    if (raw.b2b.accounts.creditHold > 0) {
      out.push({
        key: 'b2b-credit',
        severity: 'warning',
        title: `${raw.b2b.accounts.creditHold} account${raw.b2b.accounts.creditHold === 1 ? '' : 's'} on credit hold`,
        href: '/b2b/accounts',
        module: 'b2b',
        icon: 'b2b',
      });
    }
  }

  // CRM: overdue tasks.
  if (has('crm') && raw.tasks && raw.tasks.overdue > 0) {
    out.push({
      key: 'crm-tasks',
      severity: 'warning',
      title: `${raw.tasks.overdue} overdue task${raw.tasks.overdue === 1 ? '' : 's'}`,
      href: '/crm/tasks?scope=all',
      module: 'crm',
      icon: 'task',
    });
  }

  // Automations: failed runs in the window.
  if (raw.runs && raw.runs.totals.failedCount > 0) {
    out.push({
      key: 'automation-failures',
      severity: 'warning',
      title: `${raw.runs.totals.failedCount} automation run${raw.runs.totals.failedCount === 1 ? '' : 's'} failed`,
      href: '/automations',
      module: 'ai',
      icon: 'automation',
    });
  }

  // SEO: pages scoring below the healthy threshold.
  if (has('seo') && raw.seo) {
    const needs = raw.seo.filter((a) => a.score < 80).length;
    if (needs > 0) {
      out.push({
        key: 'seo',
        severity: 'info',
        title: `${needs} page${needs === 1 ? '' : 's'} need SEO fixes`,
        href: '/seo',
        module: 'seo',
        icon: 'seo',
      });
    }
  }

  return out.sort((a, b) => RANK[a.severity] - RANK[b.severity]).slice(0, 6);
}
