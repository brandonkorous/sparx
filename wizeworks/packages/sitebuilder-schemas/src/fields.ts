// SectionField — the form-generation descriptor for a section's editable
// settings. The dashboard customizer renders these (mapping each type onto a
// @wizeworks/ui control), and the section library uses the registry metadata.
// Kept independent of the CMS FieldDef so this package stays zod-only.

export type SectionFieldType =
  | 'text'
  | 'textarea'
  | 'richtext'
  | 'color'
  | 'font'
  | 'select'
  // A single-select rendered as a segmented row of buttons (instead of a
  // dropdown) — for short, glanceable option sets like size/alignment.
  | 'buttongroup'
  | 'number'
  | 'range'
  | 'boolean'
  | 'media'
  | 'url'
  | 'collection'
  | 'products'
  | 'list';

export interface SectionFieldOption {
  label: string;
  value: string;
}

export interface SectionField {
  key: string;
  label: string;
  type: SectionFieldType;
  help?: string;
  placeholder?: string;
  options?: SectionFieldOption[];
  min?: number;
  max?: number;
  step?: number;
  // For `list` fields (e.g. testimonials): the per-item editable fields.
  itemLabel?: string;
  itemFields?: SectionField[];
  // For `media` fields: opt into the visual framing modal (Fill/Fit + focal
  // point + zoom). These name the sibling config keys the modal reads/writes —
  // so the same control serves every image field. Absent = no framing control.
  fitKey?: string;
  focalKey?: string;
  zoomKey?: string;
}
