import { redirect } from 'next/navigation';

interface PageParams {
  params: Promise<{ typeKey: string }>;
}

// This standalone schema-only page predates the content-type detail view
// (`/cms/types/[typeKey]` → `_content.tsx`), which now renders the SAME
// SchemaEditor plus identity + Duplicate + the drawer/modal presentation —
// a strict superset. Nothing in the app links here anymore; redirect rather
// than maintain a second, chrome-less copy of the same editor.
export default async function EditTypeSchemaPage({ params }: PageParams) {
  const { typeKey } = await params;
  redirect(`/cms/types/${encodeURIComponent(typeKey)}`);
}
