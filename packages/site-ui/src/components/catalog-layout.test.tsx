import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Hero } from './hero';
import { Footer } from './footer';
import { Navbar } from './navbar';
import { Menu } from './menu';
import { Dock } from './dock';
import { List } from './list';
import { Table } from './table';
import { Indicator } from './indicator';
import { Join } from './join';
import { Mask } from './mask';
import { Toast } from './toast';

describe('Hero', () => {
  it('maps alignment and composes a background image', () => {
    const { container } = render(
      <Hero align="start" image="https://cdn.test/h.jpg" overlay="gradient">
        Hi
      </Hero>
    );
    const el = container.querySelector<HTMLElement>('.sf-hero')!;
    expect(el).toHaveClass('sf-hero--align-start');
    expect(el.style.backgroundImage).toContain('h.jpg');
    expect(container.querySelector('.sf-hero__content')).toHaveTextContent('Hi');
  });
});

describe('Footer', () => {
  it('renders columns + a centered modifier', () => {
    const { container } = render(
      <Footer center>
        <Footer.Column>
          <Footer.Title>Shop</Footer.Title>
        </Footer.Column>
      </Footer>
    );
    expect(container.querySelector('.sf-footer')).toHaveClass('sf-footer--center');
    expect(screen.getByText('Shop')).toHaveClass('sf-footer__title');
  });
});

describe('Navbar', () => {
  it('renders the three slots', () => {
    const { container } = render(
      <Navbar>
        <Navbar.Start>L</Navbar.Start>
        <Navbar.Center>C</Navbar.Center>
        <Navbar.End>R</Navbar.End>
      </Navbar>
    );
    expect(container.querySelector('.sf-navbar__start')).toHaveTextContent('L');
    expect(container.querySelector('.sf-navbar__center')).toHaveTextContent('C');
    expect(container.querySelector('.sf-navbar__end')).toHaveTextContent('R');
  });
});

describe('Menu', () => {
  it('maps orientation/size and item states', () => {
    const { container } = render(
      <Menu orientation="horizontal" size="lg">
        <Menu.Item href="/a" active>
          Home
        </Menu.Item>
        <Menu.Item disabled>Soon</Menu.Item>
      </Menu>
    );
    expect(container.querySelector('.sf-menu')).toHaveClass(
      'sf-menu--horizontal',
      'sf-menu--sz-lg'
    );
    expect(screen.getByRole('link', { name: 'Home' })).toHaveClass('sf-menu__item--active');
    expect(screen.getByText('Soon')).toHaveClass('sf-menu__item--disabled');
  });
});

describe('Dock', () => {
  it('renders items with active state + label', () => {
    render(
      <Dock>
        <Dock.Item href="/" active label="Home">
          <svg />
        </Dock.Item>
      </Dock>
    );
    const item = screen.getByRole('link');
    expect(item).toHaveClass('sf-dock__item', 'sf-dock__item--active');
    expect(screen.getByText('Home')).toHaveClass('sf-dock__label');
  });
});

describe('List', () => {
  it('renders rows', () => {
    const { container } = render(
      <List>
        <List.Row>a</List.Row>
        <List.Row>b</List.Row>
      </List>
    );
    expect(container.querySelectorAll('.sf-list__row')).toHaveLength(2);
  });
});

describe('Table', () => {
  it('maps modifiers and wraps in a scroll container', () => {
    const { container } = render(
      <Table zebra pinRows size="sm">
        <tbody>
          <tr>
            <td>x</td>
          </tr>
        </tbody>
      </Table>
    );
    expect(container.querySelector('.sf-table-wrap')).toBeInTheDocument();
    expect(container.querySelector('.sf-table')).toHaveClass(
      'sf-table--zebra',
      'sf-table--pin-rows',
      'sf-table--sz-sm'
    );
  });
});

describe('Indicator', () => {
  it('pins an item at a placement', () => {
    const { container } = render(
      <Indicator>
        <Indicator.Item placement="bottom-start">9</Indicator.Item>
        <button>Inbox</button>
      </Indicator>
    );
    expect(container.querySelector('.sf-indicator__item')).toHaveClass(
      'sf-indicator__item--bottom-start'
    );
  });
});

describe('Join', () => {
  it('maps orientation', () => {
    const { container } = render(
      <Join orientation="vertical">
        <button>a</button>
        <button>b</button>
      </Join>
    );
    expect(container.querySelector('.sf-join')).toHaveClass('sf-join--vertical');
  });
});

describe('Mask', () => {
  it('maps the shape', () => {
    const { container } = render(
      <Mask shape="hexagon">
        <img src="/x.jpg" alt="" />
      </Mask>
    );
    expect(container.querySelector('.sf-mask')).toHaveClass('sf-mask--hexagon');
  });
});

describe('Toast', () => {
  it('maps horizontal + vertical anchors', () => {
    const { container } = render(
      <Toast horizontal="center" vertical="top">
        <div>hi</div>
      </Toast>
    );
    expect(container.querySelector('.sf-toast')).toHaveClass(
      'sf-toast--h-center',
      'sf-toast--v-top'
    );
  });
});
