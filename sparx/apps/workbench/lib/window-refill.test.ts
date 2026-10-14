// A FILLED WINDOW FILLS THE SCREEN IT IS ON, NOT THE ONE IT WAS FILLED ON.
//
// Doty's chat was made full screen, then the trial banner took 58px off the top
// of the workspace. The pane stayed 1020px tall in a workspace that showed 947,
// and its Send button was out of sight (sparx persona issue 167).

import { describe, expect, it } from 'vitest';

import { coversView, refillView, windowsToRefill, type FloatViewport } from './window-placement';

const BEFORE: FloatViewport = { width: 1374, height: 1020, scrollLeft: 0, scrollTop: 0, zoom: 1 };
const AFTER: FloatViewport = { ...BEFORE, height: 962 };

const chat = { id: 'chat', box: { x: 0, y: 0, width: 1374, height: 1020 } };
const small = { id: 'notes', box: { x: 24, y: 24, width: 852, height: 734 } };

describe('which windows fill the screen again', () => {
  it('refits a window filled this session when the screen shrinks', () => {
    expect(windowsToRefill([chat, small], new Set(['chat']), AFTER).ids).toEqual(['chat']);
  });

  it('refits a window filled this session when the screen grows', () => {
    const shrunk = { id: 'chat', box: { x: 0, y: 0, width: 1374, height: 962 } };
    expect(windowsToRefill([shrunk], new Set(['chat']), BEFORE).ids).toEqual(['chat']);
  });

  it('treats a restored window that covers the whole screen as filled', () => {
    // Which windows were filled is not saved with the layout, so after a reload
    // the screen is the only witness. This is Doty's chat after the reload.
    expect(windowsToRefill([chat, small], new Set(), AFTER).ids).toEqual(['chat']);
  });

  it('leaves alone a window that already fills the screen', () => {
    const exact = { id: 'chat', box: { x: 0, y: 1, width: 1373, height: 962 } };
    expect(windowsToRefill([exact], new Set(['chat']), AFTER).ids).toEqual([]);
  });

  it('never touches a window somebody placed, however large', () => {
    const offCorner = { id: 'big', box: { x: 120, y: 0, width: 1600, height: 1200 } };
    expect(windowsToRefill([offCorner, small], new Set(), AFTER).ids).toEqual([]);
  });

  it('does nothing before the screen has been measured', () => {
    expect(
      windowsToRefill([chat], new Set(['chat']), { ...AFTER, width: 0, height: 0 }).ids
    ).toEqual([]);
  });
});

describe('a window covering the screen', () => {
  it("is Doty's chat, on a workspace the overflow had scrolled", () => {
    // Measured on the page after the reload: the oversized window had given the
    // workspace scroll bars, and it was sitting 2px across and 17px down.
    const view: FloatViewport = {
      width: 1359,
      height: 947,
      scrollLeft: 2,
      scrollTop: 17.33,
      zoom: 1,
    };
    expect(coversView({ x: 1, y: 1, width: 1361, height: 1020 }, view)).toBe(true);
  });

  it('covers everything visible, scrolled or not', () => {
    const scrolled: FloatViewport = { ...AFTER, scrollLeft: 400, scrollTop: 300 };
    expect(coversView({ x: 400, y: 300, width: 1374, height: 962 }, scrolled)).toBe(true);
    expect(coversView({ x: 0, y: 0, width: 1374, height: 962 }, scrolled)).toBe(false);
  });
});

describe('where a filled window goes', () => {
  // Doty's workspace after the reload: scrolled 2px across and 17px down, only
  // because his oversized chat had overflowed it.
  const scrolled: FloatViewport = {
    width: 1359,
    height: 947,
    scrollLeft: 2,
    scrollTop: 17.33,
    zoom: 1,
  };

  it('goes to the top of the workspace when nothing else needs the scroll', () => {
    // Filled where the scroll stood, it kept the scroll bars it had caused, and
    // scrolling up moved the chat 17px down the screen.
    expect(refillView([small.box], scrolled)).toEqual({ ...scrolled, scrollLeft: 0, scrollTop: 0 });
  });

  it('moves a window already filling the screen 17px down to the top', () => {
    // Doty's chat after the first fix: the right size, at the scrolled spot.
    const atScroll = { id: 'chat', box: { x: 2, y: 17, width: 1359, height: 947 } };
    expect(windowsToRefill([atScroll, small], new Set(), scrolled)).toEqual({
      ids: ['chat'],
      box: { x: 0, y: 0, width: 1359, height: 947 },
    });
  });

  it('stays where the workspace is scrolled to when another window is out there', () => {
    const farAway = { x: 2600, y: 40, width: 852, height: 734 };
    expect(refillView([small.box, farAway], scrolled)).toEqual(scrolled);
  });
});
