import { afterPaneChange } from '../../../lib/defer';
import { automationErrorMessage } from '../automations-data';
import { checkValid, docPayload } from './validation';
import type { EditorState } from './use-editor-state';

// ── Save / publish / lifecycle ──
export function onCreate(ed: EditorState) {
  const { create, siteScope, ctx, toast, setError } = ed;
  if (!checkValid(ed)) return;
  create.mutate(
    { ...docPayload(ed), propertyId: siteScope },
    {
      onSuccess: (created) => {
        ctx.open('automations.detail', { id: created.id }, { target: 'replace' });
        afterPaneChange(() => {
          toast.add({
            title: `${created.name} created`,
            description: 'It is saved as a draft. Turn it on when you are ready.',
            type: 'success',
          });
        });
      },
      onError: (e) => {
        setError(
          automationErrorMessage(e, 'Could not create this automation. Nothing was changed.')
        );
      },
    }
  );
}

export function onSave(ed: EditorState) {
  const { automation, currentDoc, update, setBaseline, setServerHasDraft, toast, setError } = ed;
  if (!automation || !checkValid(ed)) return;
  const snapshot = currentDoc;
  update.mutate(docPayload(ed), {
    onSuccess: () => {
      setBaseline(snapshot);
      setServerHasDraft(true);
      toast.add({
        title: 'Saved as a draft',
        description: 'Publish it to make your changes live.',
        type: 'success',
      });
    },
    onError: (e) => {
      setError(automationErrorMessage(e, 'Could not save this automation. Nothing was changed.'));
    },
  });
}

export async function onPublish(ed: EditorState) {
  const { automation, currentDoc, dirty, update, publish, setBaseline, setServerHasDraft } = ed;
  const { setVersion, toast, setError } = ed;
  if (!automation || !checkValid(ed)) return;
  const snapshot = currentDoc;
  try {
    if (dirty) await update.mutateAsync(docPayload(ed));
    const result = await publish.mutateAsync(undefined);
    setBaseline(snapshot);
    setServerHasDraft(false);
    setVersion(result.version);
    toast.add({
      title: `Published version ${String(result.version)}`,
      description: 'Your changes are now live.',
      type: 'success',
    });
  } catch (e) {
    setError(automationErrorMessage(e, 'Could not publish. Nothing was changed.'));
  }
}
