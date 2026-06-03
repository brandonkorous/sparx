import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Accordion } from './accordion';
import { Collapse } from './collapse';
import { Tabs } from './tabs';
import { Tooltip } from './tooltip';
import { Dialog } from './dialog';
import { Drawer } from './drawer';
import { DropdownMenu } from './dropdown-menu';
import { Popover } from './popover';

describe('Accordion', () => {
  it('applies sf- classes and shows the open item content', () => {
    const { container } = render(
      <Accordion type="single" collapsible defaultValue="a" icon="plus">
        <Accordion.Item value="a">
          <Accordion.Trigger>Section A</Accordion.Trigger>
          <Accordion.Content>Body A</Accordion.Content>
        </Accordion.Item>
        <Accordion.Item value="b">
          <Accordion.Trigger>Section B</Accordion.Trigger>
          <Accordion.Content>Body B</Accordion.Content>
        </Accordion.Item>
      </Accordion>
    );
    expect(container.querySelector('.sf-accordion')).toHaveClass('sf-accordion--plus');
    expect(screen.getByText('Section A').closest('.sf-accordion__trigger')).toHaveAttribute(
      'data-state',
      'open'
    );
    expect(screen.getByText('Body A')).toBeInTheDocument();
  });
});

describe('Collapse', () => {
  it('renders open content with sf- classes', () => {
    const { container } = render(
      <Collapse defaultOpen>
        <Collapse.Trigger>Toggle</Collapse.Trigger>
        <Collapse.Content>Hidden body</Collapse.Content>
      </Collapse>
    );
    expect(container.querySelector('.sf-collapse')).toBeInTheDocument();
    expect(screen.getByText('Hidden body')).toBeInTheDocument();
  });
});

describe('Tabs', () => {
  it('maps variant + color and activates the default panel', () => {
    const { container } = render(
      <Tabs defaultValue="a" variant="box" color="accent">
        <Tabs.List>
          <Tabs.Tab value="a">A</Tabs.Tab>
          <Tabs.Tab value="b">B</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="a">Panel A</Tabs.Panel>
        <Tabs.Panel value="b">Panel B</Tabs.Panel>
      </Tabs>
    );
    expect(container.querySelector('.sf-tabs')).toHaveClass('sf-tabs--box', 'sf-c-accent');
    expect(screen.getByRole('tab', { name: 'A' })).toHaveAttribute('data-state', 'active');
    expect(screen.getByText('Panel A')).toBeInTheDocument();
  });
});

describe('Tooltip', () => {
  it('shows the content when open, themed by color', async () => {
    render(
      <Tooltip content="Helpful hint" color="info" defaultOpen>
        <button>Hover me</button>
      </Tooltip>
    );
    const tip = await screen.findAllByText('Helpful hint');
    expect(tip.length).toBeGreaterThan(0);
    expect(tip.some((el) => el.classList.contains('sf-tooltip'))).toBe(true);
  });
});

describe('Dialog', () => {
  it('renders the panel + title when open', () => {
    render(
      <Dialog defaultOpen>
        <Dialog.Trigger>Open</Dialog.Trigger>
        <Dialog.Content placement="top">
          <Dialog.Title>Confirm</Dialog.Title>
          <Dialog.Description>Are you sure?</Dialog.Description>
        </Dialog.Content>
      </Dialog>
    );
    expect(screen.getByRole('dialog')).toHaveClass('sf-dialog', 'sf-dialog--top');
    expect(screen.getByText('Confirm')).toHaveClass('sf-dialog__title');
  });
});

describe('Drawer', () => {
  it('renders a side sheet when open', () => {
    render(
      <Drawer defaultOpen>
        <Drawer.Trigger>Open</Drawer.Trigger>
        <Drawer.Content side="left">
          <Drawer.Title>Menu</Drawer.Title>
        </Drawer.Content>
      </Drawer>
    );
    expect(screen.getByRole('dialog')).toHaveClass('sf-drawer', 'sf-drawer--left');
    expect(screen.getByText('Menu')).toHaveClass('sf-drawer__title');
  });
});

describe('DropdownMenu', () => {
  it('renders menu items when open', async () => {
    render(
      <DropdownMenu defaultOpen>
        <DropdownMenu.Trigger>Menu</DropdownMenu.Trigger>
        <DropdownMenu.Content>
          <DropdownMenu.Label>Actions</DropdownMenu.Label>
          <DropdownMenu.Item>Edit</DropdownMenu.Item>
          <DropdownMenu.Separator />
          <DropdownMenu.Item>Delete</DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu>
    );
    const edit = await screen.findByText('Edit');
    expect(edit).toHaveClass('sf-dropdown__item');
  });
});

describe('Popover', () => {
  it('renders the panel body when open', async () => {
    render(
      <Popover defaultOpen>
        <Popover.Trigger>Open</Popover.Trigger>
        <Popover.Content>Popover body</Popover.Content>
      </Popover>
    );
    const body = await screen.findByText('Popover body');
    expect(body.closest('.sf-popover')).toBeInTheDocument();
  });
});
