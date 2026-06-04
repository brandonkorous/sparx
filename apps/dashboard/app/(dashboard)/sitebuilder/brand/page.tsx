import { redirect } from 'next/navigation';

// Brand & Theme moved to the Builder (/builder/brand), which now owns the shared
// toolbar (theme switcher · Save · Publish). The Site Builder module is
// deprecated; this legacy route forwards to the one home so there's a single
// brand editor and no doubled toolbar inside the old EditorShell.
export default function BrandPage() {
  redirect('/builder/brand');
}
