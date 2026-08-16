// Applying one op to one document.
//
// The dispatcher is where an op meets the document kind it is legal on. A tree op
// on a theme, a slug op on a component — both are refused here rather than
// half-applied, because a document that accepted an op meant for another kind is
// corrupt in a way no later check can name.

import type { EmailDoc, PageDoc, StudioDoc, ThemeDoc } from '../documents/types';
import { isTreeDoc } from '../documents/types';
import { applyTreeOp } from './apply-tree';
import { isThemeOp, isTreeOp, type StudioOp, type ThemeOp } from './types';

export interface Applied {
  doc: StudioDoc;
  inverse: StudioOp;
}

export function applyOp(doc: StudioDoc, op: StudioOp): Applied | undefined {
  if (isTreeOp(op)) {
    if (!isTreeDoc(doc)) return undefined;
    const result = applyTreeOp(doc.root, op);
    if (!result) return undefined;
    return { doc: { ...doc, root: result.root }, inverse: result.inverse };
  }

  if (isThemeOp(op)) {
    if (doc.kind !== 'theme') return undefined;
    return applyThemeOp(doc, op);
  }

  switch (op.kind) {
    case 'doc.rename':
      return { doc: { ...doc, name: op.value }, inverse: { kind: 'doc.rename', value: doc.name } };

    case 'page.setSlug':
      return page(doc, (p) => ({
        doc: { ...p, slug: op.value },
        inverse: { kind: 'page.setSlug', value: p.slug },
      }));

    case 'page.setFrame':
      return page(doc, (p) => ({
        doc: { ...p, frame: op.value },
        inverse: { kind: 'page.setFrame', value: p.frame },
      }));

    case 'page.setSeo':
      return page(doc, (p) => ({
        doc: { ...p, seo: op.value },
        inverse: { kind: 'page.setSeo', value: p.seo },
      }));

    case 'page.setRecord':
      return page(doc, (p) => ({
        doc: { ...p, recordType: op.recordType, recordSubtype: op.recordSubtype },
        inverse: {
          kind: 'page.setRecord',
          recordType: p.recordType,
          recordSubtype: p.recordSubtype,
        },
      }));

    case 'page.setDefault':
      return page(doc, (p) => ({
        doc: { ...p, isDefault: op.value },
        inverse: { kind: 'page.setDefault', value: p.isDefault },
      }));

    case 'email.setSubject':
      return email(doc, (e) => ({
        doc: { ...e, document: { ...e.document, subject: op.value } },
        inverse: { kind: 'email.setSubject', value: e.document.subject },
      }));

    case 'email.setPreheader':
      return email(doc, (e) => ({
        doc: { ...e, document: { ...e.document, preheader: op.value } },
        inverse: { kind: 'email.setPreheader', value: e.document.preheader },
      }));
  }
}

function applyThemeOp(doc: ThemeDoc, op: ThemeOp): Applied | undefined {
  switch (op.kind) {
    case 'theme.setToken': {
      // Light and dark are two authored decisions on one token, held in two bags —
      // `tokens` is the base, `dark` is the delta. Writing both from one op is how
      // a dark override silently follows the light edit it was written to escape.
      const bag = op.mode === 'dark' ? (doc.theme.dark ?? {}) : doc.theme.tokens;
      const previous = bag[op.token];
      const next = { ...bag };
      if (op.value === undefined) delete next[op.token];
      else next[op.token] = op.value;
      const theme =
        op.mode === 'dark' ? { ...doc.theme, dark: next } : { ...doc.theme, tokens: next };
      return {
        doc: { ...doc, theme },
        inverse: { kind: 'theme.setToken', mode: op.mode, token: op.token, value: previous },
      };
    }

    case 'theme.setName':
      return {
        doc: { ...doc, theme: { ...doc.theme, name: op.value } },
        inverse: { kind: 'theme.setName', value: doc.theme.name },
      };

    case 'theme.replace':
      return {
        doc: { ...doc, theme: op.value },
        inverse: { kind: 'theme.replace', value: doc.theme },
      };
  }
}

function page(doc: StudioDoc, run: (p: PageDoc) => Applied): Applied | undefined {
  return doc.kind === 'page' ? run(doc) : undefined;
}

function email(doc: StudioDoc, run: (e: EmailDoc) => Applied): Applied | undefined {
  return doc.kind === 'email' ? run(doc) : undefined;
}
