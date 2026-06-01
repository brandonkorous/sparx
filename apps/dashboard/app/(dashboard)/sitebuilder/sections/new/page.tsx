import { SectionStudio } from '../../_components/section-studio';

// Create a new custom section type. A static `new` segment (takes precedence over
// the sibling `[slug]` route) so it never collides with a definition named "new".
export default function NewSectionPage() {
  return <SectionStudio mode="create" />;
}
