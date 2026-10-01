// Every `+` in the navigation panel has to be findable by what it says.

import { describe, expect, it } from 'vitest';
import { createActions, type CreatableSurface } from './launcher-create';

interface Row extends CreatableSurface {
  title: string;
  createLabel?: string;
}

const label = (row: Row) => row.createLabel;
const title = (row: Row) => row.title;

describe('createActions', () => {
  it('offers a labelled + as an action, opened the way the panel opens it', () => {
    const row: Row = {
      key: 'inventory.receiving',
      module: 'inventory',
      title: 'Deliveries',
      createSurface: 'inventory.receiving.detail',
      createLabel: 'Receive a delivery',
    };
    const [action] = createActions([row], label, title);
    expect(action).toEqual({
      id: 'create:inventory.receiving',
      surface: row,
      label: 'Receive a delivery',
      createSurface: 'inventory.receiving.detail',
      params: { id: 'new' },
      keywords: ['Deliveries'],
    });
  });

  it('keeps the door a shared create surface was opened from', () => {
    const [action] = createActions(
      [
        {
          key: 'b2b.orders',
          module: 'b2b',
          title: 'Wholesale orders',
          createSurface: 'crm.deal.detail',
          createParams: { door: 'wholesale' },
          createLabel: 'Enter an order',
        },
      ],
      label,
      title
    );
    expect(action?.params).toEqual({ id: 'new', door: 'wholesale' });
  });

  it('leaves out a row with no + and a + with no words of its own', () => {
    const actions = createActions(
      [
        { key: 'a', module: 'crm', title: 'Lists' },
        {
          key: 'b',
          module: 'crm',
          title: 'Notes',
          createSurface: 'crm.deal.detail',
          createLabel: '  ',
        },
        { key: 'c', module: 'crm', title: 'Tasks', createSurface: 'crm.task.detail' },
      ],
      label,
      title
    );
    expect(actions).toEqual([]);
  });

  it('shows one action once when two rows share it', () => {
    const shared = { module: 'crm', createSurface: 'crm.task.detail', createLabel: 'Add a task' };
    const actions = createActions(
      [
        { key: 'crm.tasks', title: 'Tasks', ...shared },
        { key: 'crm.today', title: 'Today', ...shared },
      ],
      label,
      title
    );
    expect(actions.map((a) => a.id)).toEqual(['create:crm.tasks']);
  });

  it('leaves out a + that a listed screen already is, under the same name', () => {
    const actions = createActions(
      [
        {
          key: 'commerce.orders',
          module: 'commerce',
          title: 'Orders',
          createSurface: 'crm.deal.detail',
          createLabel: 'Take a sale',
        },
        { key: 'crm.deal.detail', module: 'commerce', title: 'Take a sale' },
        {
          key: 'b2b.orders',
          module: 'b2b',
          title: 'Wholesale orders',
          createSurface: 'crm.deal.detail',
          createParams: { door: 'wholesale' },
          createLabel: 'Enter an order',
        },
      ],
      label,
      title
    );
    // The till row already says "Take a sale"; "Enter an order" is a name only
    // the + has, so it stays.
    expect(actions.map((a) => a.label)).toEqual(['Enter an order']);
  });

  it('keeps two doors to one surface apart when they open it differently', () => {
    const actions = createActions(
      [
        {
          key: 'commerce.orders',
          module: 'commerce',
          title: 'Orders',
          createSurface: 'crm.deal.detail',
          createLabel: 'Take a sale',
        },
        {
          key: 'b2b.orders',
          module: 'b2b',
          title: 'Wholesale orders',
          createSurface: 'crm.deal.detail',
          createParams: { door: 'wholesale' },
          createLabel: 'Enter an order',
        },
      ],
      label,
      title
    );
    expect(actions.map((a) => a.label)).toEqual(['Take a sale', 'Enter an order']);
  });
});
