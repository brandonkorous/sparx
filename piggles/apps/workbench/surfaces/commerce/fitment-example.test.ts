import { describe, expect, it } from 'vitest';
import { placeholderFor } from './fitment-example';

describe('placeholderFor', () => {
  it('shows the example under the parent it belongs to', () => {
    expect(placeholderFor('Make')).toBe('Ford');
    expect(placeholderFor('Model', 'Ford')).toBe('F-250 Super Duty');
    expect(placeholderFor('Engine', 'F-250 Super Duty')).toBe('6.7L Power Stroke');
  });

  it('never offers a Ford model under another make, or its engine under another model', () => {
    expect(placeholderFor('Model', 'GMC')).toBe('GMC model');
    expect(placeholderFor('Engine', 'Canyon')).toBe('Canyon engine');
  });

  it('falls back to the level name for a list of its own', () => {
    expect(placeholderFor('Engine')).toBe('An engine');
    expect(placeholderFor('Color')).toBe('A color');
  });
});
