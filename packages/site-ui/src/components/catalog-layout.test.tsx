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
    const el = container.querySelector<HTMLElement>('.st-hero')!;
    expect(el).toHaveClass('st-hero--align-start');
    expect(el.style.backgroundImage).toContain('h.jpg');
    expect(container.querySelector('.st-hero__content')).toHaveTextContent('Hi');
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
    expect(container.querySelector('.st-footer')).toHaveClass('st-footer--center');
    expect(screen.getByText('Shop')).toHaveClass('st-footer__title');
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
    expect(container.querySelector('.st-navbar__start')).toHaveTextContent('L');
    expect(container.querySelector('.st-navbar__center')).toHaveTextContent('C');
    expect(container.querySelector('.st-navbar__end')).toHaveTextContent('R');
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
    expect(container.querySelector('.st-menu')).toHaveClass(
      'st-menu--horizontal',
      'st-menu--sz-lg'
    );
    expect(screen.getByRole('link', { name: 'Home' })).toHaveClass('st-menu__item--active');
    expect(screen.getByText('Soon')).toHaveClass('st-menu__item--disabled');
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
    expect(item).toHaveClass('st-dock__item', 'st-dock__item--active');
    expect(screen.getByText('Home')).toHaveClass('st-dock__label');
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
    expect(container.querySelectorAll('.st-list__row')).toHaveLength(2);
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
    expect(container.querySelector('.st-table-wrap')).toBeInTheDocument();
    expect(container.querySelector('.st-table')).toHaveClass(
      'st-table--zebra',
      'st-table--pin-rows',
      'st-table--sz-sm'
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
    expect(container.querySelector('.st-indicator__item')).toHaveClass(
      'st-indicator__item--bottom-start'
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
    expect(container.querySelector('.st-join')).toHaveClass('st-join--vertical');
  });
});

describe('Mask', () => {
  it('maps the shape', () => {
    const { container } = render(
      <Mask shape="hexagon">
        <img src="/x.jpg" alt="" />
      </Mask>
    );
    expect(container.querySelector('.st-mask')).toHaveClass('st-mask--hexagon');
  });
});

describe('Toast', () => {
  it('maps horizontal + vertical anchors', () => {
    const { container } = render(
      <Toast horizontal="center" vertical="top">
        <div>hi</div>
      </Toast>
    );
    expect(container.querySelector('.st-toast')).toHaveClass(
      'st-toast--h-center',
      'st-toast--v-top'
    );
  });
});
