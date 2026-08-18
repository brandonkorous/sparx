import type { ContentTypeDefinition } from '../types';

// A careers / job listing. Routable for an apply page; `isOpen` lets a closed
// role stay published for SEO without inviting applications.

export const jobPostingType: ContentTypeDefinition = {
  key: 'job_posting',
  name: 'Job posting',
  pluralName: 'Careers',
  description: 'An open role with department, location, type, and description.',
  urlPattern: '/careers/{slug}',
  icon: 'briefcase',
  schema: {
    fields: [
      { key: 'title', type: 'text', label: 'Title', required: true, max: 200 },
      { key: 'department', type: 'text', label: 'Department', max: 80 },
      { key: 'location', type: 'text', label: 'Location', max: 120 },
      {
        key: 'employmentType',
        type: 'enum',
        label: 'Employment type',
        options: [
          { value: 'full_time', label: 'Full-time' },
          { value: 'part_time', label: 'Part-time' },
          { value: 'contract', label: 'Contract' },
          { value: 'internship', label: 'Internship' },
          { value: 'temporary', label: 'Temporary' },
        ],
      },
      {
        key: 'compensation',
        type: 'text',
        label: 'Compensation',
        max: 120,
        helpText: 'Optional salary range, e.g. "$120k–$150k".',
      },
      { key: 'description', type: 'rich_text', label: 'Description', required: true },
      { key: 'applyUrl', type: 'url', label: 'Apply URL' },
      { key: 'isOpen', type: 'boolean', label: 'Accepting applications', default: true },
    ],
  },
};
