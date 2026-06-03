import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeController } from './theme-controller';

afterEach(() => {
  document.documentElement.removeAttribute('data-theme');
  document.cookie = 'sparx_theme=; path=/; max-age=0';
  window.localStorage.clear();
});

describe('ThemeController', () => {
  it('renders one option per mode (segmented default)', () => {
    render(<ThemeController />);
    expect(screen.getByRole('radiogroup', { name: 'Theme' })).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(3);
  });

  it('sets data-theme + a cookie for light/dark and clears both for system', () => {
    render(<ThemeController />);
    fireEvent.click(screen.getByRole('radio', { name: 'Dark' }));
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(document.cookie).toContain('sparx_theme=dark');

    fireEvent.click(screen.getByRole('radio', { name: 'System' }));
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
    expect(document.cookie).not.toContain('sparx_theme=dark');
  });

  it('adopts a persisted cookie choice on mount', () => {
    document.cookie = 'sparx_theme=light; path=/';
    render(<ThemeController />);
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(screen.getByRole('radio', { name: 'Light' })).toHaveAttribute('aria-checked', 'true');
  });

  it('supports localStorage persistence', () => {
    render(<ThemeController persist="localStorage" storageKey="sf-theme" />);
    fireEvent.click(screen.getByRole('radio', { name: 'Dark' }));
    expect(window.localStorage.getItem('sf-theme')).toBe('dark');
  });

  it('targets a custom element and supports the select variant', () => {
    const el = document.createElement('div');
    render(<ThemeController variant="select" target={el} persist="none" aria-label="Mode" />);
    fireEvent.change(screen.getByLabelText('Mode'), { target: { value: 'dark' } });
    expect(el.getAttribute('data-theme')).toBe('dark');
  });
});
