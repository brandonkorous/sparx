// Choosing which part of a picture survives a crop (issue 869).
//
// The media worker treats DEAD CENTRE as "nobody told me" and runs a
// subject-aware crop; any other value it obeys exactly. So the centre tile is a
// different promise from the other eight, and the two must never be confused:
// a pane that highlighted "Find it for me" over a point the worker obeys would
// be describing the wrong behaviour to the person who chose it.
//
// The sharp case is a float inside the middle third that is NOT the centre —
// 0.6 / 0.5. Over the API any value in [0,1] is legal, and the media upload
// integration test already PATCHes 0.7 / 0.3, so these are reachable. No tile
// represents 0.6 / 0.5, and the rule is that nothing is highlighted rather
// than the middle one.

import { describe, expect, it } from 'vitest';

import {
  CENTRE,
  CROP_SHAPES,
  FOCAL_CELLS,
  focalClassFor,
  focalFromWire,
  focalHelp,
  focalToWire,
  isAutomatic,
  isCellChosen,
  nearestCell,
  positionName,
} from './focal-point';

const cell = (label: string) => {
  const found = FOCAL_CELLS.find((c) => c.label === label);
  if (!found) throw new Error(`no tile called ${label}`);
  return found;
};

describe('the nine tiles', () => {
  it('offers nine, in reading order, each named once', () => {
    expect(FOCAL_CELLS).toHaveLength(9);
    expect(FOCAL_CELLS.map((c) => c.label)).toEqual([
      'Top left',
      'Top',
      'Top right',
      'Left',
      'Let us choose',
      'Right',
      'Bottom left',
      'Bottom',
      'Bottom right',
    ]);
  });

  it('marks exactly one tile automatic, and it is the middle of the grid', () => {
    const automatic = FOCAL_CELLS.filter((c) => c.automatic);
    expect(automatic).toHaveLength(1);
    expect(automatic[0]).toMatchObject({ x: 0.5, y: 0.5 });
  });

  it('never calls the middle tile a position', () => {
    expect(cell('Let us choose').label.toLowerCase()).not.toContain('middle');
  });
});

describe('centre means nobody chose', () => {
  it('is automatic at dead centre', () => {
    expect(isAutomatic(CENTRE)).toBe(true);
  });

  it('mirrors the worker tolerance, so a hair off centre is still automatic', () => {
    // `isDefaultFocal` in media-worker/src/crop.ts uses < 0.001.
    expect(isAutomatic({ x: 0.5005, y: 0.4995 })).toBe(true);
    expect(isAutomatic({ x: 0.51, y: 0.5 })).toBe(false);
  });

  it('is not automatic at any tile off centre', () => {
    for (const c of FOCAL_CELLS.filter((c) => !c.automatic)) {
      expect(isAutomatic(c)).toBe(false);
    }
  });
});

describe('which tile is highlighted', () => {
  it('highlights exactly one tile for each of the nine', () => {
    for (const chosen of FOCAL_CELLS) {
      const lit = FOCAL_CELLS.filter((c) => isCellChosen(chosen, c));
      expect(lit).toEqual([chosen]);
    }
  });

  it('highlights nothing for a point inside the middle third that is not the centre', () => {
    const offGrid = { x: 0.6, y: 0.5 };
    expect(isAutomatic(offGrid)).toBe(false);
    expect(FOCAL_CELLS.filter((c) => isCellChosen(offGrid, c))).toEqual([]);
  });

  it('highlights the nearest corner for an off-grid point the worker obeys', () => {
    // The value the media upload integration test writes.
    expect(FOCAL_CELLS.filter((c) => isCellChosen({ x: 0.7, y: 0.3 }, c))).toEqual([
      cell('Top right'),
    ]);
  });
});

describe('what the sentence says', () => {
  it('promises to look for the subject only when nothing was chosen', () => {
    expect(focalHelp(CENTRE)).toContain('look for the main subject');
  });

  it('names the part kept when a part was chosen', () => {
    expect(focalHelp(cell('Bottom left'))).toBe(
      'Whatever is at the bottom left stays in frame. The rest is trimmed away.'
    );
    expect(focalHelp(cell('Right'))).toBe(
      'Whatever is at the right stays in frame. The rest is trimmed away.'
    );
  });

  it('never claims to find the subject for a point the worker obeys', () => {
    const offGrid = { x: 0.6, y: 0.5 };
    expect(focalHelp(offGrid)).not.toContain('look for the main subject');
    expect(focalHelp(offGrid)).toContain('middle');
  });
});

describe('positionName', () => {
  it('names every tile as a place', () => {
    expect(FOCAL_CELLS.map((c) => positionName(c))).toEqual([
      'top left',
      'top',
      'top right',
      'left',
      'middle',
      'right',
      'bottom left',
      'bottom',
      'bottom right',
    ]);
  });
});

describe('focalClassFor', () => {
  it('maps the nine tiles onto the nine static object-position classes', () => {
    expect(FOCAL_CELLS.map((c) => focalClassFor(c.x, c.y))).toEqual([
      'object-left-top',
      'object-top',
      'object-right-top',
      'object-left',
      'object-center',
      'object-right',
      'object-left-bottom',
      'object-bottom',
      'object-right-bottom',
    ]);
  });

  it('agrees with the highlighted tile for an off-grid point', () => {
    expect(focalClassFor(0.7, 0.3)).toBe(focalClassFor(cell('Top right').x, cell('Top right').y));
  });

  it('returns a class Tailwind can compile, never an interpolated value', () => {
    for (const c of FOCAL_CELLS) {
      expect(focalClassFor(c.x, c.y)).toMatch(/^object-[a-z-]+$/);
    }
  });
});

describe('the round trip', () => {
  it('survives read then write for every tile', () => {
    for (const c of FOCAL_CELLS) {
      const back = focalToWire(focalFromWire({ x: c.x, y: c.y }));
      expect(back).toEqual({ focal_point_x: c.x, focal_point_y: c.y });
    }
  });

  it('lands on centre when the response carries nothing', () => {
    expect(focalFromWire(undefined)).toEqual(CENTRE);
    expect(focalFromWire(null)).toEqual(CENTRE);
  });

  it('clamps rather than sending a value the column would refuse', () => {
    // media_assets has a CHECK (focal_point_x BETWEEN 0 AND 1).
    expect(focalToWire({ x: 1.4, y: -0.2 })).toEqual({ focal_point_x: 1, focal_point_y: 0 });
    expect(focalFromWire({ x: 9, y: -9 })).toEqual({ x: 1, y: 0 });
  });

  it('falls back to centre on a number that is not one', () => {
    expect(focalToWire({ x: Number.NaN, y: 0.25 })).toEqual({
      focal_point_x: 0.5,
      focal_point_y: 0.25,
    });
  });
});

describe('the shapes previewed', () => {
  it('lists exactly the four the media worker bakes, in its order', () => {
    // SOCIAL_ASPECTS in media-worker/src/crop.ts.
    expect(CROP_SHAPES.map((s) => s.aspect)).toEqual(['1:1', '4:5', '9:16', '16:9']);
  });

  it('describes each shape in words rather than a ratio', () => {
    for (const shape of CROP_SHAPES) {
      expect(shape.label).not.toContain(':');
      expect(shape.where.length).toBeGreaterThan(0);
    }
  });
});

describe('nearestCell', () => {
  it('is pure geometry and always lands on a tile', () => {
    expect(nearestCell({ x: 0, y: 0 })).toEqual(cell('Top left'));
    expect(nearestCell({ x: 0.9, y: 0.95 })).toEqual(cell('Bottom right'));
    expect(nearestCell({ x: 0.6, y: 0.5 })).toEqual(cell('Let us choose'));
  });
});
