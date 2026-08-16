import { describe, expect, it } from 'vitest';
import { orderInternals } from './orders';
import { productInternals } from './products';
import { codeFor } from './resolve';
import { getProcessor, supportedEntities } from './index';

// The pure halves of the processors — the grouping, the status mapping and the id
// derivation. Everything else in these files talks to the database and belongs in an
// integration suite; these are the parts where a quiet mistake corrupts a tenant's
// data rather than throwing, which makes them the parts worth pinning down here.

describe('the processor registry', () => {
    it('covers every entity the API can create a job for', () => {
        const entities = supportedEntities();
        for (const entity of [
            'products',
            'inventory_levels',
            'customers',
            'orders',
            'categories',
            'collections',
            'discounts',
            'content',
            'media',
            'redirects',
            'companies',
            'deals',
            'tickets',
            'segments',
            'suppliers',
            'purchase_orders',
            'b2b_accounts',
        ]) {
            expect(entities, `no processor for ${entity}`).toContain(entity);
        }
    });

    it('gives every processor a run and a preview', () => {
        for (const entity of supportedEntities()) {
            const processor = getProcessor(entity);
            expect(typeof processor?.run).toBe('function');
            expect(typeof processor?.preview).toBe('function');
        }
    });

    it('returns nothing for an entity that does not exist', () => {
        expect(getProcessor('unicorns')).toBeUndefined();
    });
});

describe('product grouping', () => {
    const { groupRows, optionsOf, fallbackSku } = productInternals;

    it('turns rows sharing a handle into one product', () => {
        const groups = groupRows([
            { handle: 'tee', title: 'Tee', sku: 'TEE-S' },
            { handle: 'tee', title: 'Tee', sku: 'TEE-M' },
            { handle: 'mug', title: 'Mug', sku: 'MUG' },
        ]);
        expect(groups).toHaveLength(2);
        expect(groups[0]!.rows).toHaveLength(2);
    });

    it('keeps the row index each variant came from', () => {
        // The whole point: an error on the fourth variant of the ninth product has to
        // point at the line the tenant can find in their own spreadsheet.
        const groups = groupRows([
            { handle: 'mug', title: 'Mug', sku: 'MUG' },
            { handle: 'tee', title: 'Tee', sku: 'TEE-S' },
            { handle: 'tee', title: 'Tee', sku: 'TEE-M' },
        ]);
        expect(groups[1]!.rows.map((entry) => entry.rowIndex)).toEqual([1, 2]);
    });

    it('falls back to the SKU and then the title when there is no handle column', () => {
        expect(groupRows([{ sku: 'MUG-01', title: 'Mug' }])[0]!.handle).toBe('mug-01');
        expect(groupRows([{ title: 'Blue Mug' }])[0]!.handle).toBe('blue-mug');
    });

    it('drops a row that identifies nothing rather than inventing a product', () => {
        expect(groupRows([{ price: '10' }])).toHaveLength(0);
    });

    it('collects option values in the order the file had them', () => {
        const [group] = groupRows([
            { handle: 'tee', title: 'Tee', option1_name: 'Size', option1_value: 'Large' },
            { handle: 'tee', title: 'Tee', option1_name: 'Size', option1_value: 'Small' },
            { handle: 'tee', title: 'Tee', option1_name: 'Size', option1_value: 'Medium' },
        ]);
        // Large, Small, Medium — not sorted. The tenant's order is a decision.
        expect(optionsOf(group!)).toEqual([{ name: 'Size', values: ['Large', 'Small', 'Medium'] }]);
    });

    it('does not repeat an option value that appears twice', () => {
        const [group] = groupRows([
            { handle: 'tee', title: 'Tee', option1_name: 'Color', option1_value: 'Blue' },
            { handle: 'tee', title: 'Tee', option1_name: 'Color', option1_value: 'Blue' },
        ]);
        expect(optionsOf(group!)[0]!.values).toEqual(['Blue']);
    });

    it('mints a deterministic SKU for a variant that arrived without one', () => {
        // Deterministic matters: a re-run of the same file has to update the same
        // variant rather than minting a second one beside it.
        const row = { option1_value: 'Small' };
        expect(fallbackSku('blue-tee', 0, row)).toBe(fallbackSku('blue-tee', 0, row));
        expect(fallbackSku('blue-tee', 0, row)).toBe('BLUE-TEE-SMALL');
        expect(fallbackSku('blue-tee', 2, {})).toBe('BLUE-TEE-3');
    });
});

describe('order grouping', () => {
    const { gather, statusOf, paymentStatusOf } = orderInternals;

    it('regroups the flattened line rows back into orders', () => {
        const groups = gather([
            { order_number: '#1001', total: '40.00', line_sku: 'A' },
            { order_number: '#1001', line_sku: 'B' },
            { order_number: '#1002', total: '10.00', line_sku: 'C' },
        ]);
        expect(groups).toHaveLength(2);
        expect(groups[0]!.lines).toHaveLength(2);
        expect(groups[0]!.head.total).toBe('40.00');
        expect(groups[0]!.rowIndexes).toEqual([0, 1]);
    });

    it('ignores a row with no order number rather than inventing one', () => {
        expect(gather([{ line_sku: 'A' }])).toHaveLength(0);
    });

    it('reads payment status across every platform spelling', () => {
        expect(paymentStatusOf('paid')).toBe('paid');
        expect(paymentStatusOf('CAPTURED')).toBe('paid');
        expect(paymentStatusOf('partially paid')).toBe('partially_paid');
        expect(paymentStatusOf('refunded')).toBe('refunded');
        expect(paymentStatusOf('pending')).toBe('unpaid');
        expect(paymentStatusOf(undefined)).toBe('unpaid');
    });

    it('reads order status from whichever column carries it', () => {
        expect(statusOf({ fulfillment_status: 'fulfilled' })).toBe('fulfilled');
        expect(statusOf({ fulfillment_status: 'delivered' })).toBe('delivered');
        expect(statusOf({ financial_status: 'refunded' })).toBe('refunded');
        expect(statusOf({ financial_status: 'voided' })).toBe('cancelled');
        expect(statusOf({})).toBe('placed');
    });

    it('lets a refund beat a fulfilment, because it happened later', () => {
        expect(statusOf({ financial_status: 'refunded', fulfillment_status: 'fulfilled' })).toBe(
            'refunded'
        );
    });
});

describe('codeFor', () => {
    it('makes a warehouse code that fits the 15-character constraint', () => {
        expect(codeFor('Main Warehouse')).toBe('MAIN-WAREHOUSE');
        expect(codeFor('A very long location name indeed').length).toBeLessThanOrEqual(15);
    });

    it('strips punctuation the column will not accept', () => {
        expect(codeFor("Sam's Shop (North)")).toBe('SAM-S-SHOP-NORT');
    });

    it('never returns an empty code', () => {
        expect(codeFor('!!!')).toBe('LOC');
        expect(codeFor('')).toBe('LOC');
    });

    it('never ends in a hyphen, which the code regex allows but reads as a typo', () => {
        expect(codeFor('Warehouse Number ')).not.toMatch(/-$/);
    });
});
