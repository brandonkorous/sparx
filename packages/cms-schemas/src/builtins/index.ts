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
// Widget-shaped types — being reclassified into builder components + nested
// fields (docs/51 §7). Retained here until the apps/web migration lands.
import { moduleType } from './module';
import { featureType } from './feature';
import { faqItemType } from './faq-item';
import { editorialSectionType } from './editorial-section';

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
  moduleType,
  featureType,
  faqItemType,
  editorialSectionType,
};

// The base set of page-level content types every tenant gets. The data
// migration that seeds `content_types` mirrors this array. Order is not
// significant — the new types don't cross-reference (the old module → feature
// reference is gone; features are a nested repeater on landing_page now).

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
  // Widget-shaped, pending reclassification (docs/51 §7) — removed in Slice 3.
  featureType,
  faqItemType,
  editorialSectionType,
  moduleType,
];

export const PLATFORM_TENANT_ID = '00000000-0000-0000-0000-000000000000';
