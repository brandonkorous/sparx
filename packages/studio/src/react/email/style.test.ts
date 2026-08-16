import { describe, expect, it } from 'vitest';
import { emailStylesheet } from './style';
import { emailBody, emailText } from '../../testing/fixtures';

describe('emailStylesheet', () => {
  it('scopes every rule to the canvas it was built for', () => {
    // Two email panes can be open at once. An unscoped rule would repaint the
    // other one's blocks — and both would look right until they diverged.
    const lines = emailStylesheet(emailBody(), 'c1').split('\n');
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) expect(line.startsWith('[data-studio-email="c1"]')).toBe(true);
  });

  it('writes line spacing in PIXELS', () => {
    // `TextNode.lineHeight` is a px count and the projector emits it as one.
    // Unitless it would multiply the font size — a 16px line 24 lines tall.
    expect(emailStylesheet(emailBody(), 'c1')).toContain('line-height:24px');
  });

  it('paints the wallpaper from the body’s own background', () => {
    expect(emailStylesheet(emailBody(), 'c1')).toContain(
      '[data-studio-email="c1"]{background-color:#F3F4F6}'
    );
  });

  it('cannot be escaped by a value the author typed', () => {
    // A colour box is a text field, and a stylesheet is the one place a stray
    // brace stops being a typo and starts writing rules for the rest of the page.
    const root = emailBody();
    root.children[0]!.children[0] = {
      ...emailText('greeting', 'x'),
      color: '#fff}body{display:none',
    };
    const css = emailStylesheet(root, 'c1');
    expect(css).not.toContain('body{display:none');
    expect(css).toContain('color:#fffbodydisplay:none');
  });
});
