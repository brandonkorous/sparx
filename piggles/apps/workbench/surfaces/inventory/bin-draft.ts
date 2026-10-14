// The shelf form's editable state, and how it maps to and from a saved shelf.

import type { Bin } from './bins-data';

export interface Draft {
  warehouseId: string;
  code: string;
  name: string;
  zone: string;
  aisle: string;
  rack: string;
  shelf: string;
  type: string;
  pickSequence: string;
  capacityUnits: string;
  notes: string;
  /** Where things go when nobody says a shelf. Exactly one per location. */
  isDefault: boolean;
}

export type SetDraftField = <K extends keyof Draft>(key: K, value: Draft[K]) => void;

export const EMPTY: Draft = {
  warehouseId: '',
  code: '',
  name: '',
  zone: '',
  aisle: '',
  rack: '',
  shelf: '',
  type: 'pick',
  pickSequence: '',
  capacityUnits: '',
  notes: '',
  isDefault: false,
};

export function draftFrom(bin: Bin): Draft {
  return {
    warehouseId: bin.warehouseId,
    code: bin.code,
    name: bin.name ?? '',
    zone: bin.zone ?? '',
    aisle: bin.aisle ?? '',
    rack: bin.rack ?? '',
    shelf: bin.shelf ?? '',
    type: bin.type,
    pickSequence: bin.pickSequence === null ? '' : String(bin.pickSequence),
    capacityUnits: bin.capacityUnits === null ? '' : String(bin.capacityUnits),
    notes: bin.notes ?? '',
    isDefault: bin.isDefault,
  };
}

export function payloadFrom(draft: Draft) {
  return {
    warehouseId: draft.warehouseId,
    code: draft.code.trim(),
    type: draft.type,
    ...(draft.name.trim() ? { name: draft.name.trim() } : {}),
    ...(draft.zone.trim() ? { zone: draft.zone.trim() } : {}),
    ...(draft.aisle.trim() ? { aisle: draft.aisle.trim() } : {}),
    ...(draft.rack.trim() ? { rack: draft.rack.trim() } : {}),
    ...(draft.shelf.trim() ? { shelf: draft.shelf.trim() } : {}),
    ...(draft.pickSequence.trim() ? { pickSequence: Number(draft.pickSequence) } : {}),
    ...(draft.capacityUnits.trim() ? { capacityUnits: Number(draft.capacityUnits) } : {}),
    ...(draft.notes.trim() ? { notes: draft.notes.trim() } : {}),
    isDefault: draft.isDefault,
  };
}
