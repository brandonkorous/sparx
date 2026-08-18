-- Expand the built-in content-type set to a solid base of 10 page-level shapes
-- (docs/51 §7). Adds 8 new types alongside the existing `page` + `blog_post`:
-- landing_page, news_article, case_study, event, team_member, job_posting,
-- help_article, announcement.
--
-- TS source of truth: packages/cms-schemas/src/builtins/*. Idempotent upsert
-- under the sentinel platform tenant, mirroring 20260528100100. The widget-
-- shaped types (feature/faq_item/editorial_section/module) are reclassified
-- into builder components + nested fields and removed in a later migration.
--
-- `updated_at` is set explicitly: 20260528100100 dropped its DB default (Prisma
-- manages @updatedAt), so a bare INSERT would violate NOT NULL.

SET LOCAL app.tenant_id = '00000000-0000-0000-0000-000000000000';

-- ─────────────────────────────────────────────────────────────────────────
-- landing_page
-- ─────────────────────────────────────────────────────────────────────────

INSERT INTO "content_types" (
    "id", "tenant_id", "key", "name", "plural_name", "description",
    "schema_json", "url_pattern", "icon", "is_singleton", "is_built_in", "updated_at"
) VALUES (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000000',
    'landing_page',
    'Landing page',
    'Landing pages',
    'Campaign or product landing page with a hero, feature grid, and CTA.',
    $json${
      "fields": [
        { "key": "title", "type": "text", "label": "Title", "required": true, "max": 255 },
        { "key": "eyebrow", "type": "text", "label": "Eyebrow", "max": 80,
          "helpText": "Short label above the headline." },
        { "key": "headline", "type": "text", "label": "Headline", "required": true, "max": 200 },
        { "key": "subheadline", "type": "long_text", "label": "Subheadline", "max": 400 },
        { "key": "heroImage", "type": "asset", "label": "Hero image", "accept": ["image/*"] },
        { "key": "body", "type": "rich_text", "label": "Body" },
        { "key": "features", "type": "repeater", "label": "Features", "itemLabel": "Feature", "max": 12,
          "helpText": "Feature cards rendered by the feature-grid component.",
          "fields": [
            { "key": "title", "type": "text", "label": "Title", "required": true, "max": 120 },
            { "key": "body", "type": "long_text", "label": "Body", "required": true, "max": 600 },
            { "key": "icon", "type": "text", "label": "Icon", "max": 40,
              "helpText": "Lucide icon name (optional)." }
          ]
        },
        { "key": "ctaLabel", "type": "text", "label": "CTA label", "max": 60 },
        { "key": "ctaUrl", "type": "url", "label": "CTA URL" }
      ]
    }$json$::jsonb,
    '/{slug}',
    'rocket',
    FALSE,
    TRUE,
    NOW()
)
ON CONFLICT ("tenant_id", "key") DO UPDATE SET
    "name" = EXCLUDED."name", "plural_name" = EXCLUDED."plural_name",
    "description" = EXCLUDED."description", "schema_json" = EXCLUDED."schema_json",
    "url_pattern" = EXCLUDED."url_pattern", "icon" = EXCLUDED."icon",
    "is_singleton" = EXCLUDED."is_singleton", "is_built_in" = EXCLUDED."is_built_in",
    "updated_at" = NOW();

-- ─────────────────────────────────────────────────────────────────────────
-- news_article
-- ─────────────────────────────────────────────────────────────────────────

INSERT INTO "content_types" (
    "id", "tenant_id", "key", "name", "plural_name", "description",
    "schema_json", "url_pattern", "icon", "is_singleton", "is_built_in", "updated_at"
) VALUES (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000000',
    'news_article',
    'News article',
    'News',
    'News item or press mention, optionally linking to an external source.',
    $json${
      "fields": [
        { "key": "title", "type": "text", "label": "Title", "required": true, "max": 255 },
        { "key": "excerpt", "type": "long_text", "label": "Excerpt", "required": true, "max": 500,
          "helpText": "Shown on index pages, in feeds, and in search results." },
        { "key": "body", "type": "rich_text", "label": "Body" },
        { "key": "featuredImage", "type": "asset", "label": "Featured image", "accept": ["image/*"] },
        { "key": "source", "type": "text", "label": "Source", "max": 120,
          "helpText": "Publication or outlet, for curated coverage." },
        { "key": "externalUrl", "type": "url", "label": "External URL",
          "helpText": "Link to the original article when this is outside coverage." }
      ]
    }$json$::jsonb,
    '/news/{slug}',
    'newspaper',
    FALSE,
    TRUE,
    NOW()
)
ON CONFLICT ("tenant_id", "key") DO UPDATE SET
    "name" = EXCLUDED."name", "plural_name" = EXCLUDED."plural_name",
    "description" = EXCLUDED."description", "schema_json" = EXCLUDED."schema_json",
    "url_pattern" = EXCLUDED."url_pattern", "icon" = EXCLUDED."icon",
    "is_singleton" = EXCLUDED."is_singleton", "is_built_in" = EXCLUDED."is_built_in",
    "updated_at" = NOW();

-- ─────────────────────────────────────────────────────────────────────────
-- case_study
-- ─────────────────────────────────────────────────────────────────────────

INSERT INTO "content_types" (
    "id", "tenant_id", "key", "name", "plural_name", "description",
    "schema_json", "url_pattern", "icon", "is_singleton", "is_built_in", "updated_at"
) VALUES (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000000',
    'case_study',
    'Case study',
    'Case studies',
    'Customer success story with challenge, solution, results, and metrics.',
    $json${
      "fields": [
        { "key": "title", "type": "text", "label": "Title", "required": true, "max": 255 },
        { "key": "client", "type": "text", "label": "Client", "required": true, "max": 160 },
        { "key": "industry", "type": "text", "label": "Industry", "max": 80 },
        { "key": "summary", "type": "long_text", "label": "Summary", "required": true, "max": 600 },
        { "key": "heroImage", "type": "asset", "label": "Hero image", "accept": ["image/*"] },
        { "key": "challenge", "type": "rich_text", "label": "Challenge", "required": true },
        { "key": "solution", "type": "rich_text", "label": "Solution", "required": true },
        { "key": "results", "type": "rich_text", "label": "Results", "required": true },
        { "key": "metrics", "type": "repeater", "label": "Metrics", "itemLabel": "Metric", "max": 6,
          "helpText": "Headline numbers, e.g. \"Revenue\" / \"+40%\".",
          "fields": [
            { "key": "label", "type": "text", "label": "Label", "required": true, "max": 80 },
            { "key": "value", "type": "text", "label": "Value", "required": true, "max": 40 }
          ]
        }
      ]
    }$json$::jsonb,
    '/case-studies/{slug}',
    'award',
    FALSE,
    TRUE,
    NOW()
)
ON CONFLICT ("tenant_id", "key") DO UPDATE SET
    "name" = EXCLUDED."name", "plural_name" = EXCLUDED."plural_name",
    "description" = EXCLUDED."description", "schema_json" = EXCLUDED."schema_json",
    "url_pattern" = EXCLUDED."url_pattern", "icon" = EXCLUDED."icon",
    "is_singleton" = EXCLUDED."is_singleton", "is_built_in" = EXCLUDED."is_built_in",
    "updated_at" = NOW();

-- ─────────────────────────────────────────────────────────────────────────
-- event
-- ─────────────────────────────────────────────────────────────────────────

INSERT INTO "content_types" (
    "id", "tenant_id", "key", "name", "plural_name", "description",
    "schema_json", "url_pattern", "icon", "is_singleton", "is_built_in", "updated_at"
) VALUES (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000000',
    'event',
    'Event',
    'Events',
    'A scheduled event with start/end times, location, and registration.',
    $json${
      "fields": [
        { "key": "title", "type": "text", "label": "Title", "required": true, "max": 255 },
        { "key": "description", "type": "rich_text", "label": "Description", "required": true },
        { "key": "startAt", "type": "datetime", "label": "Starts", "required": true },
        { "key": "endAt", "type": "datetime", "label": "Ends" },
        { "key": "location", "type": "text", "label": "Location", "max": 200,
          "helpText": "Venue and address, or the platform for a virtual event." },
        { "key": "isVirtual", "type": "boolean", "label": "Virtual event" },
        { "key": "registrationUrl", "type": "url", "label": "Registration URL" },
        { "key": "featuredImage", "type": "asset", "label": "Featured image", "accept": ["image/*"] }
      ]
    }$json$::jsonb,
    '/events/{slug}',
    'calendar',
    FALSE,
    TRUE,
    NOW()
)
ON CONFLICT ("tenant_id", "key") DO UPDATE SET
    "name" = EXCLUDED."name", "plural_name" = EXCLUDED."plural_name",
    "description" = EXCLUDED."description", "schema_json" = EXCLUDED."schema_json",
    "url_pattern" = EXCLUDED."url_pattern", "icon" = EXCLUDED."icon",
    "is_singleton" = EXCLUDED."is_singleton", "is_built_in" = EXCLUDED."is_built_in",
    "updated_at" = NOW();

-- ─────────────────────────────────────────────────────────────────────────
-- team_member
-- ─────────────────────────────────────────────────────────────────────────

INSERT INTO "content_types" (
    "id", "tenant_id", "key", "name", "plural_name", "description",
    "schema_json", "url_pattern", "icon", "is_singleton", "is_built_in", "updated_at"
) VALUES (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000000',
    'team_member',
    'Team member',
    'Team',
    'A staff or team member profile with role, bio, and photo.',
    $json${
      "fields": [
        { "key": "name", "type": "text", "label": "Name", "required": true, "max": 160 },
        { "key": "role", "type": "text", "label": "Role", "required": true, "max": 120 },
        { "key": "bio", "type": "rich_text", "label": "Bio" },
        { "key": "photo", "type": "asset", "label": "Photo", "accept": ["image/*"] },
        { "key": "email", "type": "email", "label": "Email" },
        { "key": "linkedinUrl", "type": "url", "label": "LinkedIn URL" },
        { "key": "order", "type": "number", "label": "Order", "integer": true,
          "helpText": "Lower numbers appear first in team listings." }
      ]
    }$json$::jsonb,
    '/team/{slug}',
    'user-round',
    FALSE,
    TRUE,
    NOW()
)
ON CONFLICT ("tenant_id", "key") DO UPDATE SET
    "name" = EXCLUDED."name", "plural_name" = EXCLUDED."plural_name",
    "description" = EXCLUDED."description", "schema_json" = EXCLUDED."schema_json",
    "url_pattern" = EXCLUDED."url_pattern", "icon" = EXCLUDED."icon",
    "is_singleton" = EXCLUDED."is_singleton", "is_built_in" = EXCLUDED."is_built_in",
    "updated_at" = NOW();

-- ─────────────────────────────────────────────────────────────────────────
-- job_posting
-- ─────────────────────────────────────────────────────────────────────────

INSERT INTO "content_types" (
    "id", "tenant_id", "key", "name", "plural_name", "description",
    "schema_json", "url_pattern", "icon", "is_singleton", "is_built_in", "updated_at"
) VALUES (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000000',
    'job_posting',
    'Job posting',
    'Careers',
    'An open role with department, location, type, and description.',
    $json${
      "fields": [
        { "key": "title", "type": "text", "label": "Title", "required": true, "max": 200 },
        { "key": "department", "type": "text", "label": "Department", "max": 80 },
        { "key": "location", "type": "text", "label": "Location", "max": 120 },
        { "key": "employmentType", "type": "enum", "label": "Employment type",
          "options": [
            { "value": "full_time", "label": "Full-time" },
            { "value": "part_time", "label": "Part-time" },
            { "value": "contract", "label": "Contract" },
            { "value": "internship", "label": "Internship" },
            { "value": "temporary", "label": "Temporary" }
          ] },
        { "key": "compensation", "type": "text", "label": "Compensation", "max": 120,
          "helpText": "Optional salary range, e.g. \"$120k–$150k\"." },
        { "key": "description", "type": "rich_text", "label": "Description", "required": true },
        { "key": "applyUrl", "type": "url", "label": "Apply URL" },
        { "key": "isOpen", "type": "boolean", "label": "Accepting applications", "default": true }
      ]
    }$json$::jsonb,
    '/careers/{slug}',
    'briefcase',
    FALSE,
    TRUE,
    NOW()
)
ON CONFLICT ("tenant_id", "key") DO UPDATE SET
    "name" = EXCLUDED."name", "plural_name" = EXCLUDED."plural_name",
    "description" = EXCLUDED."description", "schema_json" = EXCLUDED."schema_json",
    "url_pattern" = EXCLUDED."url_pattern", "icon" = EXCLUDED."icon",
    "is_singleton" = EXCLUDED."is_singleton", "is_built_in" = EXCLUDED."is_built_in",
    "updated_at" = NOW();

-- ─────────────────────────────────────────────────────────────────────────
-- help_article
-- ─────────────────────────────────────────────────────────────────────────

INSERT INTO "content_types" (
    "id", "tenant_id", "key", "name", "plural_name", "description",
    "schema_json", "url_pattern", "icon", "is_singleton", "is_built_in", "updated_at"
) VALUES (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000000',
    'help_article',
    'Help article',
    'Help center',
    'A knowledge-base or documentation article.',
    $json${
      "fields": [
        { "key": "title", "type": "text", "label": "Title", "required": true, "max": 200 },
        { "key": "summary", "type": "long_text", "label": "Summary", "max": 400,
          "helpText": "One-line answer shown in the help index and search results." },
        { "key": "body", "type": "rich_text", "label": "Body", "required": true },
        { "key": "category", "type": "text", "label": "Category", "max": 80,
          "helpText": "Grouping label, e.g. \"Billing\" or \"Getting started\"." }
      ]
    }$json$::jsonb,
    '/help/{slug}',
    'life-buoy',
    FALSE,
    TRUE,
    NOW()
)
ON CONFLICT ("tenant_id", "key") DO UPDATE SET
    "name" = EXCLUDED."name", "plural_name" = EXCLUDED."plural_name",
    "description" = EXCLUDED."description", "schema_json" = EXCLUDED."schema_json",
    "url_pattern" = EXCLUDED."url_pattern", "icon" = EXCLUDED."icon",
    "is_singleton" = EXCLUDED."is_singleton", "is_built_in" = EXCLUDED."is_built_in",
    "updated_at" = NOW();

-- ─────────────────────────────────────────────────────────────────────────
-- announcement
-- ─────────────────────────────────────────────────────────────────────────

INSERT INTO "content_types" (
    "id", "tenant_id", "key", "name", "plural_name", "description",
    "schema_json", "url_pattern", "icon", "is_singleton", "is_built_in", "updated_at"
) VALUES (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000000',
    'announcement',
    'Announcement',
    'Announcements',
    'A first-party company announcement or press release.',
    $json${
      "fields": [
        { "key": "title", "type": "text", "label": "Title", "required": true, "max": 255 },
        { "key": "excerpt", "type": "long_text", "label": "Excerpt", "required": true, "max": 400,
          "helpText": "Shown on index pages, in feeds, and in search results." },
        { "key": "body", "type": "rich_text", "label": "Body", "required": true },
        { "key": "featuredImage", "type": "asset", "label": "Featured image", "accept": ["image/*"] }
      ]
    }$json$::jsonb,
    '/press/{slug}',
    'megaphone',
    FALSE,
    TRUE,
    NOW()
)
ON CONFLICT ("tenant_id", "key") DO UPDATE SET
    "name" = EXCLUDED."name", "plural_name" = EXCLUDED."plural_name",
    "description" = EXCLUDED."description", "schema_json" = EXCLUDED."schema_json",
    "url_pattern" = EXCLUDED."url_pattern", "icon" = EXCLUDED."icon",
    "is_singleton" = EXCLUDED."is_singleton", "is_built_in" = EXCLUDED."is_built_in",
    "updated_at" = NOW();
