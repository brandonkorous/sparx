// The one-way door (docs/120 slice 7): every email authored on the retired sparx
// builder must survive the move to silica. These lock the conversion down, because it
// runs against real tenant rows exactly once and there is no going back — a bug here is
// a silently mangled email, not a crash.
//
// The fixtures are the shapes actually found in the live `builder_emails` table (all
// ten node types), not invented ones.

import { describe, expect, it } from 'vitest';

import { emailTreeToSilica, emailTreeToSilicaBody } from './email-legacy-to-silica';
import type { BuilderNode } from './node';

let seq = 0;
const node = (
  type: string,
  props: Record<string, unknown> = {},
  children?: BuilderNode[]
): BuilderNode => ({
  id: `n-${type}-${(seq += 1)}`,
  type,
  props,
  ...(children ? { children } : {}),
});

/** The `welcome-customer` default as it is actually stored today. */
const welcomeTree = (): BuilderNode =>
  node('Section', {}, [
    node('email_wordmark', { size: 'md', align: 'left', treatment: 'lockup' }),
    node('Heading', { text: 'Welcome to {{site.name}}', level: 'h1' }),
    node('Text', {
      text: 'Hi {{customer.firstName ?? "there"}} — thanks for joining.',
      variant: 'body',
    }),
    node('Button', { href: '{{site.url}}', label: 'Start shopping' }),
  ]);

/** Every text run in a document, flattened — what the reader ends up seeing. */
function copyOf(body: ReturnType<typeof emailTreeToSilicaBody>): string {
  const out: string[] = [];
  const walk = (n: unknown): void => {
    if (!n || typeof n !== 'object') return;
    const x = n as { kind?: string; html?: string; label?: string; children?: unknown[] };
    if (x.kind === 'text' && x.html) out.push(x.html);
    if (x.kind === 'button' && x.label) out.push(x.label);
    if (Array.isArray(x.children)) x.children.forEach(walk);
  };
  body.forEach(walk);
  return out.join(' | ');
}

describe('emailTreeToSilica', () => {
  it("preserves the author's copy, including its merge tokens", () => {
    // The whole point: an edited email keeps the words the tenant wrote. Tokens must
    // survive verbatim — silica interpolates `{{…}}` itself, and the `??` fallback is
    // handled by sparx's pass over the projected HTML, so neither may be mangled here.
    const copy = copyOf(emailTreeToSilicaBody(welcomeTree()));
    expect(copy).toContain('Welcome to {{site.name}}');
    expect(copy).toContain('{{customer.firstName ?? "there"}}');
    expect(copy).toContain('Start shopping');
  });

  it('drops the three nodes the send now COMPOSES, so they cannot double up', () => {
    // wordmark → the branded frame; unsubscribe + postal address → the marketing
    // footer. Carrying them into the body would print each of them twice.
    const body = emailTreeToSilicaBody(
      node('Section', {}, [
        node('email_wordmark', {}),
        node('Text', { text: 'Body copy.' }),
        node('unsubscribe_link', {}),
        node('physical_address', {}),
      ])
    );
    expect(copyOf(body)).toBe('Body copy.');
  });

  it('produces a valid silica body: sections at the top, never a section in a section', () => {
    // silica's schema is closed — `body → section → columns|content`. A legacy
    // `Section` was just a flex column, so it must flatten rather than nest.
    const body = emailTreeToSilicaBody(
      node('Section', {}, [node('Section', {}, [node('Text', { text: 'Nested.' })])])
    );
    expect(body.every((s) => s.kind === 'section')).toBe(true);
    for (const s of body) {
      expect(s.children.some((c) => (c as { kind: string }).kind === 'section')).toBe(false);
    }
    expect(copyOf(body)).toBe('Nested.');
  });

  it('turns a conditional_block into a bound section — the show/hide wrapper', () => {
    const body = emailTreeToSilicaBody(
      node('Section', {}, [
        node('Text', { text: 'Always.' }),
        node('conditional_block', { when: 'order.shippingAddress' }, [
          node('Text', { text: 'Shipping to:' }),
        ]),
      ])
    );
    // The gate rides on the section's data binding; the resolver drops the whole
    // section when the ref is empty (`hideWhenEmpty`), which IS the conditional.
    const gated = body.find((s) => s.data?.kind === 'value');
    expect(gated?.data).toEqual({ kind: 'value', ref: 'order.shippingAddress' });
    expect(copyOf([gated!])).toBe('Shipping to:');
    // …and the unconditional copy did NOT get swept into the gated section.
    expect(copyOf(body.filter((s) => !s.data))).toContain('Always.');
  });

  it('expands a line_item_table into a header section + a repeating row section', () => {
    const table = node('line_item_table', {});
    (table as { binding?: unknown }).binding = { path: 'invoice.items' };
    const body = emailTreeToSilicaBody(node('Section', {}, [table]));
    const repeating = body.filter((s) => s.data?.kind === 'collection');
    // Exactly ONE section repeats — the rows. A header that repeated would print the
    // column captions once per line item.
    expect(repeating).toHaveLength(1);
    expect(repeating[0]!.data).toEqual({ kind: 'collection', ref: 'invoice.items' });
  });

  it('keeps reading order when a block interrupts a run of copy', () => {
    // A conditional/table splits the surrounding copy into separate sections; what must
    // NOT happen is the trailing copy jumping above the block.
    const body = emailTreeToSilicaBody(
      node('Section', {}, [
        node('Text', { text: 'Before.' }),
        node('conditional_block', { when: 'x' }, [node('Text', { text: 'Middle.' })]),
        node('Text', { text: 'After.' }),
      ])
    );
    expect(copyOf(body)).toBe('Before. | Middle. | After.');
  });

  it('carries a bound leaf across as a bound silica node', () => {
    const bound = node('Text', { text: '' });
    (bound as { binding?: unknown }).binding = { path: 'order.number' };
    const [s] = emailTreeToSilicaBody(node('Section', {}, [bound]));
    expect((s!.children[0] as { data?: unknown }).data).toEqual({
      kind: 'value',
      ref: 'order.number',
    });
  });

  it('never throws on a body that converts to nothing', () => {
    // A tree that was ONLY chrome (wordmark + compliance footer) yields an empty body —
    // valid, and the send composes its frame around it. A throw here would break a send.
    const doc = emailTreeToSilica(
      node('Section', {}, [node('email_wordmark', {}), node('unsubscribe_link', {})]),
      'Subject',
      null
    );
    expect(doc.root.children).toEqual([]);
    expect(doc.subject).toBe('Subject');
    expect(doc.preheader).toBe('');
  });

  it('drops an unknown node rather than guessing at it', () => {
    const body = emailTreeToSilicaBody(
      node('Section', {}, [node('SomeFutureNode', { text: 'x' }), node('Text', { text: 'Kept.' })])
    );
    expect(copyOf(body)).toBe('Kept.');
  });
});
