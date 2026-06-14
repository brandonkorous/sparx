import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Skeleton } from './skeleton';
import { Spinner, type SpinnerKind } from './spinner';
import { Progress } from './progress';
import { Breadcrumb, BreadcrumbItem } from './breadcrumb';
import { Pagination, paginationRange } from './pagination';

describe('Skeleton', () => {
  it('maps the shape and applies width/height', () => {
    const { container } = render(<Skeleton shape="circle" width={40} height="2rem" />);
    const el = container.querySelector<HTMLElement>('.st-skeleton')!;
    expect(el).toHaveClass('st-skeleton--circle');
    expect(el.style.width).toBe('40px');
    expect(el.style.height).toBe('2rem');
    expect(el).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('Spinner', () => {
  it('renders a labelled status with the kind + size classes', () => {
    render(<Spinner kind="ring" size="lg" label="Saving" />);
    const el = screen.getByRole('status');
    expect(el).toHaveClass('st-spinner', 'st-spinner--ring', 'st-spinner--sz-lg');
    expect(screen.getByText('Saving')).toHaveClass('st-spinner__label');
  });

  it('renders three child elements for dots and bars', () => {
    const cases: [SpinnerKind, string][] = [
      ['dots', '.st-spinner__dot'],
      ['bars', '.st-spinner__bar'],
    ];
    for (const [kind, sel] of cases) {
      const { container, unmount } = render(<Spinner kind={kind} />);
      expect(container.querySelectorAll(sel)).toHaveLength(3);
      unmount();
    }
  });
});

describe('Progress', () => {
  it('renders a determinate bar with the color role var and aria values', () => {
    const { container } = render(<Progress value={25} max={50} color="success" />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveClass('st-progress', 'st-c-success');
    expect(bar).toHaveAttribute('aria-valuenow', '25');
    expect(bar).toHaveAttribute('aria-valuemax', '50');
    const fill = container.querySelector<HTMLElement>('.st-progress__fill')!;
    expect(fill.style.width).toBe('50%');
  });

  it('is indeterminate with no value', () => {
    const { container } = render(<Progress />);
    expect(container.querySelector('.st-progress')).toHaveClass('st-progress--indeterminate');
    expect(screen.getByRole('progressbar')).not.toHaveAttribute('aria-valuenow');
  });
});

describe('Breadcrumb', () => {
  it('renders links for crumbs and plain text for the current page', () => {
    render(
      <Breadcrumb>
        <Breadcrumb.Item href="/">Home</Breadcrumb.Item>
        <Breadcrumb.Item href="/shop">Shop</Breadcrumb.Item>
        <BreadcrumbItem current>Model 3</BreadcrumbItem>
      </Breadcrumb>
    );
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Shop' })).toHaveAttribute('href', '/shop');
    const current = screen.getByText('Model 3');
    expect(current).toHaveClass('st-breadcrumb__current');
    expect(current).toHaveAttribute('aria-current', 'page');
  });
});

describe('Pagination', () => {
  it('builds a collapsed range with ellipses', () => {
    expect(paginationRange(1, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(paginationRange(1, 10)).toEqual([1, 2, 3, 4, 5, 'ellipsis', 10]);
    expect(paginationRange(6, 10)).toEqual([1, 'ellipsis', 5, 6, 7, 'ellipsis', 10]);
    expect(paginationRange(10, 10)).toEqual([1, 'ellipsis', 6, 7, 8, 9, 10]);
  });

  it('renders nothing for a single page', () => {
    const { container } = render(<Pagination page={1} total={1} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('marks the active page and disables prev at the start', () => {
    const { container } = render(<Pagination page={1} total={5} hrefFor={(p) => `/p/${p}`} />);
    expect(screen.getByRole('link', { name: '1' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: '2' })).toHaveAttribute('href', '/p/2');
    expect(container.querySelector('.st-pagination__item--disabled')).toBeInTheDocument();
  });
});
