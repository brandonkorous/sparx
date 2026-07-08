'use client';

import * as React from 'react';

import { Input, Label } from 'silicaui-react';

import type { MappingControls } from './types';

// Shared UoM + safety-buffer inputs for a mapping (P5b) — used by both the
// SKU-mappings add form and the unmapped-SKU map form. Held as strings; empties
// fall back to the server defaults (1:1 UoM, no buffer).

export interface ControlsState {
  unitsPerExternal: string;
  externalUom: string;
  safetyBuffer: string;
}

export const EMPTY_CONTROLS: ControlsState = {
  unitsPerExternal: '',
  externalUom: '',
  safetyBuffer: '',
};

/** Parse the string fields into a MappingControls body — empties are omitted so the
 *  server's defaults (units 1, no UoM, no buffer) apply. */
export function controlsToBody(s: ControlsState): MappingControls {
  const body: MappingControls = {};
  const units = parseInt(s.unitsPerExternal, 10);
  if (Number.isFinite(units) && units > 1) body.unitsPerExternal = units;
  if (s.externalUom.trim()) body.externalUom = s.externalUom.trim();
  const buffer = parseInt(s.safetyBuffer, 10);
  if (Number.isFinite(buffer) && buffer > 0) body.safetyBuffer = buffer;
  return body;
}

export function MappingControlsFields({
  idPrefix,
  state,
  onChange,
}: {
  idPrefix: string;
  state: ControlsState;
  onChange: (next: ControlsState) => void;
}) {
  return (
    <div className="flex flex-row flex-wrap items-end gap-3">
      <div className="flex min-w-[6rem] flex-col gap-1">
        <Label htmlFor={`${idPrefix}-units`}>Units / pack</Label>
        <Input
          id={`${idPrefix}-units`}
          type="number"
          min={1}
          placeholder="1"
          value={state.unitsPerExternal}
          onChange={(e) => onChange({ ...state, unitsPerExternal: e.target.value })}
        />
      </div>
      <div className="flex min-w-[7rem] flex-col gap-1">
        <Label htmlFor={`${idPrefix}-uom`}>Pack label</Label>
        <Input
          id={`${idPrefix}-uom`}
          placeholder="e.g. case"
          value={state.externalUom}
          onChange={(e) => onChange({ ...state, externalUom: e.target.value })}
        />
      </div>
      <div className="flex min-w-[7rem] flex-col gap-1">
        <Label htmlFor={`${idPrefix}-buffer`}>Safety buffer</Label>
        <Input
          id={`${idPrefix}-buffer`}
          type="number"
          min={0}
          placeholder="0"
          value={state.safetyBuffer}
          onChange={(e) => onChange({ ...state, safetyBuffer: e.target.value })}
        />
      </div>
    </div>
  );
}
