'use client';

// The control rail — everything a theme IS, in the order someone decides it.
//
// Name, then colors, then shape, then the quieter physical properties. The board
// beside it never changes shape as sections are opened, because the rail scrolls
// inside its own column: a control that pushes the thing it is previewing off
// screen is a control nobody can use.

import {
  Alert,
  AlertDescription,
  AlertTitle,
  Field,
  FieldLabel,
  Input,
} from '@wizeworks/silicaui-react';
import type { ThemeDoc } from '../../documents/types';
import { useApply, useDoc } from '../context';
import { ColorsSection } from './colors-section';
import { CornersSection } from './corners-section';
import { useThemeEdit } from './edit-context';
import { RailSection } from './rail-section';
import { ScalarControl } from './scalar-control';
import { scalarsIn } from './scalar';

export function ThemeRail() {
  const { mode, editable } = useThemeEdit();

  return (
    <div className="bg-base-100 min-h-0 flex-1 overflow-auto">
      {!editable ? <ReadOnlyNotice /> : null}
      {mode === 'dark' ? <DarkNotice /> : null}

      <NameSection />
      <ColorsSection />
      <CornersSection />

      <RailSection
        icon="sliders"
        title="Outlines and size"
        hint="How heavy the lines are, and how much room controls take up."
      >
        {scalarsIn('form').map((token) => (
          <ScalarControl key={token.key} token={token} />
        ))}
      </RailSection>

      <RailSection
        icon="eye"
        title="Depth and focus"
        hint="Whether things lift off the page, and how the keyboard outline looks."
      >
        {scalarsIn('effects').map((token) => (
          <ScalarControl key={token.key} token={token} />
        ))}
      </RailSection>

      <RailSection
        icon="zap"
        title="Movement"
        hint="How quickly things respond when they are touched."
      >
        {scalarsIn('motion').map((token) => (
          <ScalarControl key={token.key} token={token} />
        ))}
      </RailSection>
    </div>
  );
}

function NameSection() {
  const doc = useDoc<ThemeDoc>();
  const apply = useApply();
  const { editable } = useThemeEdit();

  return (
    <div className="border-base-300 border-b px-4 py-5">
      <Field>
        <FieldLabel className="text-base">Name of this look</FieldLabel>
        <Input
          key={`${doc.id}:name`}
          defaultValue={doc.name}
          disabled={!editable}
          onBlur={(event) => {
            const value = event.currentTarget.value.trim();
            if (!value || value === doc.name) return;
            apply('Rename', [{ kind: 'doc.rename', value }]);
          }}
        />
      </Field>
    </div>
  );
}

function ReadOnlyNotice() {
  return (
    <Alert color="info" variant="soft" className="m-4">
      <AlertTitle>This is one of our ready-made looks</AlertTitle>
      <AlertDescription>
        Make a copy to change it — the original stays available to everyone.
      </AlertDescription>
    </Alert>
  );
}

function DarkNotice() {
  return (
    <Alert color="info" variant="soft" className="m-4">
      <AlertTitle>You are editing the dark version</AlertTitle>
      <AlertDescription>
        Anything you leave alone here uses its light-mode value. Change one and it stops following.
      </AlertDescription>
    </Alert>
  );
}
