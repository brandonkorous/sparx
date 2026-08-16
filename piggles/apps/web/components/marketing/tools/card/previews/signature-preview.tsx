import { buildSignature } from '../../lib/signature';

/** The tool's real output, rendered by the tool's own builder. */
const html = buildSignature({
  name: 'Ada Keller',
  jobTitle: 'Owner',
  company: 'Bella Cafe',
  email: 'ada@bellacafe.example',
  phone: '(555) 123-4567',
  website: '',
  imageUrl: '',
  accent: '#FF6F86',
  layout: 'stacked',
  tagline: '',
});

export function SignaturePreview() {
  return (
    <div className="rounded-field w-full bg-white p-3" dangerouslySetInnerHTML={{ __html: html }} />
  );
}
