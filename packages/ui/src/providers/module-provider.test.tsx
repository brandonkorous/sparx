import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { ModuleProvider, type SparxModule } from './module-provider';

/**
 * These assert the ATTRIBUTE, not a color.
 *
 * The suite used to check `wrapper.style.getPropertyValue('--color-module')`
 * against a literal `#14B8A6`, mirroring a hex table that lived in the component
 * — so it locked in the very duplication that let that table drift out of sync
 * with `@sparx/brand/theme.css` and ship white ink on Commerce orange at 2.80:1.
 * A test that pins a copy of a value is how the copy survives.
 *
 * The contract now is: render `data-module`, and nothing else. What that
 * attribute resolves to is theme.css's business.
 */
describe('ModuleProvider', () => {
    it('marks the subtree with the module, and sets no inline color', () => {
        const { container } = render(
            <ModuleProvider module="cms">
                <div>child</div>
            </ModuleProvider>
        );
        const wrapper = container.firstElementChild as HTMLElement;
        expect(wrapper.dataset.module).toBe('cms');
        expect(wrapper.style.getPropertyValue('--color-module')).toBe('');
        expect(wrapper.style.getPropertyValue('--color-module-content')).toBe('');
    });

    it('switches the attribute when the module prop changes', () => {
        const modules: SparxModule[] = ['cms', 'commerce', 'crm'];
        for (const m of modules) {
            const { container, unmount } = render(
                <ModuleProvider module={m}>
                    <div />
                </ModuleProvider>
            );
            expect((container.firstElementChild as HTMLElement).dataset.module).toBe(m);
            unmount();
        }
    });

    it('nests, so an inner module wins by cascade proximity', () => {
        const { container } = render(
            <ModuleProvider module="crm">
                <ModuleProvider module="commerce">
                    <div data-testid="leaf" />
                </ModuleProvider>
            </ModuleProvider>
        );
        const outer = container.firstElementChild as HTMLElement;
        const inner = outer.firstElementChild as HTMLElement;
        expect(outer.dataset.module).toBe('crm');
        expect(inner.dataset.module).toBe('commerce');
    });

    it('passes className and style through for layout', () => {
        const { container } = render(
            <ModuleProvider module="cms" className="flex" style={{ gap: 8 }}>
                <div />
            </ModuleProvider>
        );
        const wrapper = container.firstElementChild as HTMLElement;
        expect(wrapper.className).toBe('flex');
        expect(wrapper.style.gap).toBe('8px');
    });
});
