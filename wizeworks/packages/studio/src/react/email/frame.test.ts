// The email canvas draws the header and footer every send adds (persona issue
// 129). Devi's Booking reminder showed the body alone on the canvas, and her
// "Juniper Row" bar and the legal footer only in Preview. They are drawn around
// the body, styled by the same rules, and inert: nothing in them can be
// selected or moved, because they are not part of the email being edited.

import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactElement } from 'react';
import type { EmailFrame } from '@wizeworks/silicaui-builder/email';
import { describe, expect, it } from 'vitest';

import { emailBody, emailSection, emailText } from '../../testing/fixtures';
import { renderEmailNode, type EmailRenderContext } from './render';
import { emailStylesheet, framedEmailRoot } from './style';

const FRAME: EmailFrame = {
  header: [emailSection('frame-bar', [emailText('frame-name', 'Juniper Row')])],
  footer: [
    emailSection('frame-legal', [emailText('frame-footer', 'You are getting this because')]),
  ],
  label: 'Every email gets this header and footer from your brand.',
};

function draw(ctx: Partial<EmailRenderContext> = {}): string {
  const full: EmailRenderContext = {
    preview: undefined,
    selectedIds: [],
    hoverId: null,
    dropHint: null,
    ...ctx,
  };
  return renderToStaticMarkup(renderEmailNode(emailBody(), full) as ReactElement);
}

describe('the email canvas frame', () => {
  it('draws the header above the email and the footer below it', () => {
    const html = draw({ frame: FRAME });
    const header = html.indexOf('Juniper Row');
    const body = html.indexOf('Hello there');
    const footer = html.indexOf('You are getting this because');
    expect(header).toBeGreaterThan(-1);
    expect(header).toBeLessThan(body);
    expect(body).toBeLessThan(footer);
  });

  it('marks the frame as not part of the email, and says so on hover', () => {
    const html = draw({ frame: FRAME });
    expect(html.match(/data-email-frame=""/g)).toHaveLength(2);
    expect(html).toContain(`title="${FRAME.label!}"`);
  });

  it('lets nothing in the frame be dragged, selected or hovered', () => {
    const html = draw({
      frame: FRAME,
      selectedIds: ['frame-name'],
      hoverId: 'frame-bar',
    });
    const header = html.slice(html.indexOf('data-email-frame'), html.indexOf('data-enode="intro"'));
    expect(header).not.toContain('draggable="true"');
    expect(header).not.toContain('outline');
    // The email's own blocks still drag.
    expect(html).toMatch(/data-enode="intro" draggable="true"/);
  });

  it('draws nothing extra when there is no frame', () => {
    expect(draw()).not.toContain('data-email-frame');
  });

  it('styles the frame by the same rules as the email', () => {
    const css = emailStylesheet(framedEmailRoot(emailBody(), FRAME), 'c1');
    expect(css).toContain('[data-enode="frame-bar"]');
    expect(css).toContain('[data-enode="frame-name"]');
    expect(css).toContain('[data-enode="greeting"]');
  });
});
