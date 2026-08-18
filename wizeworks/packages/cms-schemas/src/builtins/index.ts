import type { ContentTypeDefinition } from '../types';
import { pageType } from './page';
import { blogPostType } from './blog-post';
import { landingPageType } from './landing-page';
import { newsArticleType } from './news-article';
import { caseStudyType } from './case-study';
import { eventType } from './event';
import { teamMemberType } from './team-member';
import { jobPostingType } from './job-posting';
import { helpArticleType } from './help-article';
import { announcementType } from './announcement';

export {
  pageType,
  blogPostType,
  landingPageType,
  newsArticleType,
  caseStudyType,
  eventType,
  teamMemberType,
  jobPostingType,
  helpArticleType,
  announcementType,
};

// The base set of page-level content types every tenant gets. The data
// migration that seeds `content_types` mirrors this array. Order is not
// significant — these types don't cross-reference.
//
// The old widget-shaped types (feature / faq_item / editorial_section / module)
// were reclassified into builder components (docs/51 §7): they're page content
// authored in the builder, not standalone content items. See the FAQ /
// FeatureGrid / EditorialSection components in the builder registry, and the
// `20260628000000_remove_widget_content_types` migration that drops them.

export const BUILT_IN_CONTENT_TYPES: readonly ContentTypeDefinition[] = [
  pageType,
  blogPostType,
  landingPageType,
  newsArticleType,
  caseStudyType,
  eventType,
  teamMemberType,
  jobPostingType,
  helpArticleType,
  announcementType,
];

export const PLATFORM_TENANT_ID = '00000000-0000-0000-0000-000000000000';
