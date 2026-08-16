'use client';

// A saved piece's own settings, in the Inspector, under the piece itself.
//
// Just the name — but the name is what an author picks this out of a list by, so a
// piece stuck with "My piece" is one nobody can find again. Renaming is an edit to
// the document like any other: unsaved until Save, undoable with ⌘Z.

import { Field, FieldDescription, FieldLabel, Input } from '@wizeworks/silicaui-react';
import type { ComponentDoc } from '@wizeworks/studio';
import { useApply, useDoc } from '@wizeworks/studio/react';
import { pieceKeyOf } from '../builder/studio/saved-pieces';

export function PieceSettingsPanel() {
  const doc = useDoc<ComponentDoc>();
  const apply = useApply();
  const shared = pieceKeyOf(doc.id) !== null;

  return (
    <div className="border-base-300 mt-4 flex flex-col gap-4 border-t pt-4">
      <p className="text-base-content text-sm font-medium">This piece</p>
      <Field>
        <FieldLabel>Name</FieldLabel>
        <Input
          key={`${doc.id}:name`}
          defaultValue={doc.name}
          onBlur={(event) => {
            const value = event.currentTarget.value.trim();
            if (!value || value === doc.name) return;
            apply('Rename piece', [{ kind: 'doc.rename', value }]);
          }}
        />
        <FieldDescription>
          {shared
            ? 'How it appears in your list of pieces, on every site you own.'
            : 'How it appears in your list of pieces.'}
        </FieldDescription>
      </Field>
    </div>
  );
}
