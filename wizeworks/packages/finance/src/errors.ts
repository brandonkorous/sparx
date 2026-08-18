// Typed errors for the finance module. Each carries a stable `code` so REST /
// Server Actions / MCP map to the platform error envelope (docs/06 §4).

export class FinanceError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'FinanceError';
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ExpenseNotFoundError extends FinanceError {
  constructor(id: string) {
    super('EXPENSE_NOT_FOUND', `Expense ${id} not found`);
    this.name = 'ExpenseNotFoundError';
  }
}

export class ExpenseCategoryNotFoundError extends FinanceError {
  constructor(id: string) {
    super('EXPENSE_CATEGORY_NOT_FOUND', `Expense category ${id} not found`);
    this.name = 'ExpenseCategoryNotFoundError';
  }
}

export class VendorNotFoundError extends FinanceError {
  constructor(id: string) {
    super('VENDOR_NOT_FOUND', `Vendor ${id} not found`);
    this.name = 'VendorNotFoundError';
  }
}

export class RecurringExpenseNotFoundError extends FinanceError {
  constructor(id: string) {
    super('RECURRING_EXPENSE_NOT_FOUND', `Recurring expense ${id} not found`);
    this.name = 'RecurringExpenseNotFoundError';
  }
}

/**
 * A seeded category cannot be deleted — a deriver finds it by slug, so removing
 * it would break labour costing or the sparx-bill import silently, months later.
 * Renaming and recoloring stay allowed: the owner's vocabulary wins over ours
 * everywhere it is only a label.
 */
export class SystemCategoryError extends FinanceError {
  constructor(name: string) {
    super(
      'SYSTEM_CATEGORY_PROTECTED',
      `"${name}" is a built-in category and cannot be deleted. You can rename it, or archive it to hide it from the list.`
    );
    this.name = 'SystemCategoryError';
  }
}

/**
 * Deleting a category that still has spend filed against it would silently
 * rewrite history, so the DB refuses it (ON DELETE RESTRICT) and so do we —
 * earlier, and with a sentence a business owner can act on.
 */
export class CategoryInUseError extends FinanceError {
  constructor(name: string, count: number) {
    super(
      'CATEGORY_IN_USE',
      `"${name}" still has ${count} ${count === 1 ? 'expense' : 'expenses'} filed under it. Move them to another category first, or archive this one to hide it from the list.`
    );
    this.name = 'CategoryInUseError';
  }
}

/**
 * Allocations may not exceed the expense they split.
 *
 * Note the asymmetry, which is intentional: allocating LESS than the total is
 * perfectly valid and means the remainder is overhead — the cost of being open.
 * Allocating MORE is always an error, because it charges jobs for money nobody
 * spent.
 */
export class OverAllocatedError extends FinanceError {
  constructor(allocatedCents: number, amountCents: number) {
    super(
      'EXPENSE_OVER_ALLOCATED',
      `This splits ${formatCents(allocatedCents)} across jobs, which is more than the ${formatCents(amountCents)} expense itself.`
    );
    this.name = 'OverAllocatedError';
  }
}

/** Plain-language money for an error a non-technical owner will read. */
function formatCents(cents: number): string {
  return `${cents < 0 ? '-' : ''}$${(Math.abs(cents) / 100).toFixed(2)}`;
}
