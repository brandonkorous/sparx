'use client';

// Saving, re-checking and deleting a collection — everything the editor writes,
// away from everything it draws.
//
// A new MANUAL collection is two calls: create it, then set its members. The
// second is a plain POST rather than the collection-scoped hook, because that
// hook binds to an id that did not exist a moment ago.

import { useConfirm } from '../../lib/confirm';
import { useToast } from '@wizeworks/silicaui-react';
import { api } from '../../lib/api/client';
import { afterPaneChange } from '../../lib/defer';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { sameSet, type Draft } from './collection-draft';
import { slugify } from '../../lib/slugify';
import {
  buildRuleSet,
  collectionErrorMessage,
  useCreateCollection,
  useDeleteCollection,
  useReindexCollection,
  useSetCollectionProducts,
  useUpdateCollection,
  type CollectionRuleSet,
} from './collections-data';

export function useCollectionWrites({
  ctx,
  id,
  isNew,
  draft,
  savedProductIds,
  handle,
  collection,
  nameError,
  setRuleError,
  onSaved,
}: {
  ctx: SurfaceContext;
  id: string;
  isNew: boolean;
  draft: Draft;
  savedProductIds: string[];
  /** The address the field is showing, which is what gets claimed. */
  handle: string;
  /** The saved collection, when there is one — deleting needs its name and count. */
  collection: { name: string; productCount: number } | null;
  nameError: string | null;
  setRuleError: (next: string | null) => void;
  /** Called once the server has confirmed, so the form can adopt it. */
  onSaved: () => void;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const create = useCreateCollection();
  const update = useUpdateCollection(id);
  const setProducts = useSetCollectionProducts(id);
  const reindex = useReindexCollection(id);
  const remove = useDeleteCollection(id);

  const failure =
    create.isError || update.isError || setProducts.isError
      ? collectionErrorMessage(
          create.error ?? update.error ?? setProducts.error,
          'Could not save this collection. Nothing was changed.'
        )
      : null;

  const nullable = (value: string) => (value.trim() === '' ? null : value.trim());

  const submit = () => {
    if (nameError) return;
    setRuleError(null);

    // An automatic collection MUST carry a rule set the compiler accepts. This is
    // the one hard gate: validate against the real schema before anything is
    // written, and name the first problem in plain words.
    let ruleSet: CollectionRuleSet | undefined;
    if (draft.type === 'rules') {
      const result = buildRuleSet(draft.ruleSet);
      if (!result.ok) {
        setRuleError(
          draft.ruleSet.predicates.length === 0
            ? 'Add at least one condition so the collection knows which products to include.'
            : result.error
        );
        return;
      }
      ruleSet = result.value;
    }

    if (isNew) {
      create.mutate(
        {
          name: draft.name.trim(),
          handle: slugify(handle, 120) || undefined,
          description: nullable(draft.description),
          type: draft.type,
          ...(ruleSet ? { ruleSet } : {}),
          heroMediaId: draft.heroMediaId,
          featured: draft.featured,
          seoTitle: nullable(draft.seoTitle),
          seoDescription: nullable(draft.seoDescription),
          ogImageId: draft.ogImageId,
          propertyIds: draft.propertyIds,
        },
        {
          onSuccess: (created) => {
            const land = () => {
              ctx.open('commerce.collection.detail', { id: created.id }, { target: 'replace' });
              afterPaneChange(() => {
                toast.add({ title: `${draft.name.trim()} created`, type: 'success' });
              });
            };
            // A brand-new manual collection with members set has to write them in
            // a second call, now that the collection exists to hang them off.
            if (draft.type === 'manual' && draft.productIds.length > 0) {
              void setProductsAfterCreate(created.id, draft.productIds).finally(land);
            } else {
              land();
            }
          },
        }
      );
      return;
    }

    void (async () => {
      try {
        await update.mutateAsync({
          name: draft.name.trim(),
          handle: slugify(handle, 120),
          description: nullable(draft.description),
          ...(ruleSet ? { ruleSet } : {}),
          heroMediaId: draft.heroMediaId,
          featured: draft.featured,
          seoTitle: nullable(draft.seoTitle),
          seoDescription: nullable(draft.seoDescription),
          ogImageId: draft.ogImageId,
          propertyIds: draft.propertyIds,
        });
        if (draft.type === 'manual' && !sameSet(draft.productIds, savedProductIds)) {
          await setProducts.mutateAsync(draft.productIds);
        }
        onSaved();
        toast.add({ title: 'Collection saved', type: 'success' });
      } catch {
        // The alert in the body reports it; the draft still holds everything.
      }
    })();
  };

  const onReindex = () => {
    reindex.mutate(undefined, {
      onSuccess: () => {
        toast.add({
          title: 'Re-checking which products match',
          description:
            'This happens in the background, so the count here updates shortly rather than instantly.',
          type: 'success',
        });
      },
      onError: (error) => {
        toast.add({
          title: 'Could not start the re-check',
          description: collectionErrorMessage(error, 'Nothing was changed. Try again in a moment.'),
          type: 'error',
        });
      },
    });
  };

  const onDelete = async () => {
    if (!collection) return;
    const count = collection.productCount;
    const ok = await confirm({
      title: `Delete ${collection.name}?`,
      description:
        count > 0
          ? `This collection is removed from your website. The ${String(count)} product${count === 1 ? '' : 's'} in it ${count === 1 ? 'is' : 'are'} kept — only the grouping goes. This cannot be undone.`
          : 'This collection is removed from your website. The products themselves are kept. This cannot be undone.',
      confirmLabel: 'Delete this collection',
      cancelLabel: 'Keep it',
      color: 'danger',
    });
    if (!ok) return;
    remove.mutate(undefined, {
      onSuccess: () => {
        ctx.close();
        afterPaneChange(() => {
          toast.add({ title: `${collection.name} deleted`, type: 'success' });
        });
      },
      onError: (error) => {
        toast.add({
          title: 'Could not delete this collection',
          description: collectionErrorMessage(error, 'Nothing was removed.'),
          type: 'error',
        });
      },
    });
  };

  return {
    submit,
    onReindex,
    onDelete,
    failure,
    saving: create.isPending || update.isPending || setProducts.isPending,
    created: create.isSuccess,
    reindexing: reindex.isPending,
    deleting: remove.isPending,
  };
}

/**
 * Set a freshly-created manual collection's members.
 *
 * A plain function, not a hook: it runs in a create callback AFTER the collection
 * exists, so the collection-scoped `useSetCollectionProducts(id)` — bound to the
 * id we did not have a moment ago — cannot serve. Failure is soft: the collection
 * was created, so the pane still lands on it and the member write can be retried
 * there.
 */
async function setProductsAfterCreate(collectionId: string, productIds: string[]): Promise<void> {
  await api
    .post('/v1/commerce/collections/set-products', { collectionId, productIds })
    .catch(() => undefined);
}
