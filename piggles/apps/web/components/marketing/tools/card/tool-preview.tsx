import type { ReactNode } from 'react';
import { QrPreview } from './previews/qr-preview';
import { BarcodePreview } from './previews/barcode-preview';
import { PalettePreview } from './previews/palette-preview';
import { FaviconPreview } from './previews/favicon-preview';
import { MetaPreview } from './previews/meta-preview';
import { ContrastPreview } from './previews/contrast-preview';
import { DocumentPreview } from './previews/document-preview';
import { MarginPreview } from './previews/margin-preview';
import { DeliverabilityPreview } from './previews/deliverability-preview';
import { SignaturePreview } from './previews/signature-preview';
import { UtmPreview } from './previews/utm-preview';
import { OgPreview } from './previews/og-preview';
import { SchemaPreview } from './previews/schema-preview';
import { VcardPreview } from './previews/vcard-preview';
import { DomainPreview } from './previews/domain-preview';
import { LegalPreview } from './previews/legal-preview';

/** Slug → the artefact that tool makes. Every tool has one: a card with an empty
 *  frame is the junk-drawer grid this replaced. */
const PREVIEWS: Record<string, () => ReactNode> = {
  favicon: FaviconPreview,
  'qr-code': QrPreview,
  'utm-builder': UtmPreview,
  'og-image': OgPreview,
  'email-signature': SignaturePreview,
  invoice: () => <DocumentPreview kind="invoice" />,
  'email-deliverability': DeliverabilityPreview,
  'meta-tags': MetaPreview,
  'color-palette': PalettePreview,
  'margin-calculator': MarginPreview,
  quote: () => <DocumentPreview kind="quote" />,
  'structured-data': SchemaPreview,
  'contrast-checker': ContrastPreview,
  barcode: BarcodePreview,
  'digital-card': VcardPreview,
  'privacy-policy': LegalPreview,
  'domain-checker': DomainPreview,
};

export function hasPreview(slug: string): boolean {
  return slug in PREVIEWS;
}

export function ToolPreview({ slug }: { slug: string }) {
  const Preview = PREVIEWS[slug];
  return Preview ? <Preview /> : null;
}
