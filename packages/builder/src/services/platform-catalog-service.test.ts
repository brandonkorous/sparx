// Unit tests for platform-catalog-service lifecycle + visibility rules.
// Mocks @sparx/db so no live database is needed.

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

// Mock @sparx/db before importing the service
vi.mock('@sparx/db', () => {
  const mockPrisma = {
    platformComponent: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  };
  return { prisma: mockPrisma };
});

import { prisma } from '@sparx/db';
import * as svc from './platform-catalog-service';

const mockPlatformComponent = prisma.platformComponent as {
  findUnique: Mock;
  findMany: Mock;
  create: Mock;
  update: Mock;
  delete: Mock;
};

function makeRow(
  overrides: Partial<{
    id: string;
    key: string;
    name: string;
    family: string;
    kind: string;
    tree: unknown;
    behaviors: unknown;
    thumbnail: string | null;
    tags: string[];
    status: string;
    authorId: string;
    reviewerId: string | null;
    version: number;
    visibility: string;
    createdAt: Date;
    updatedAt: Date;
  }> = {},
) {
  return {
    id: 'pc_123',
    key: 'hero_split',
    name: 'Split Hero',
    family: 'hero',
    kind: 'comprehensive',
    tree: { id: 'root', type: 'Section', class: '', props: {}, children: [] },
    behaviors: null,
    thumbnail: null,
    tags: [],
    status: 'draft',
    authorId: 'user_abc',
    reviewerId: null,
    version: 1,
    visibility: 'public',
    createdAt: new Date('2026-09-01T00:00:00Z'),
    updatedAt: new Date('2026-09-01T00:00:00Z'),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('platformCatalogService — lifecycle transitions', () => {
  it('allows draft → submitted', async () => {
    const row = makeRow({ status: 'draft' });
    mockPlatformComponent.findUnique.mockResolvedValue(row);
    mockPlatformComponent.update.mockResolvedValue({
      ...row,
      status: 'submitted',
      reviewerId: 'rev_1',
    });
    const result = await svc.submit('pc_123', 'rev_1');
    expect(result.status).toBe('submitted');
    expect(mockPlatformComponent.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'submitted' }) }),
    );
  });

  it('allows submitted → in_review', async () => {
    const row = makeRow({ status: 'submitted' });
    mockPlatformComponent.findUnique.mockResolvedValue(row);
    mockPlatformComponent.update.mockResolvedValue({
      ...row,
      status: 'in_review',
      reviewerId: 'rev_1',
    });
    const result = await svc.startReview('pc_123', 'rev_1');
    expect(result.status).toBe('in_review');
  });

  it('allows in_review → approved', async () => {
    const row = makeRow({ status: 'in_review' });
    mockPlatformComponent.findUnique.mockResolvedValue(row);
    mockPlatformComponent.update.mockResolvedValue({ ...row, status: 'approved' });
    const result = await svc.approve('pc_123', 'rev_1');
    expect(result.status).toBe('approved');
  });

  it('allows approved → published', async () => {
    const row = makeRow({ status: 'approved' });
    mockPlatformComponent.findUnique.mockResolvedValue(row);
    mockPlatformComponent.update.mockResolvedValue({ ...row, status: 'published' });
    const result = await svc.publish('pc_123', 'rev_1');
    expect(result.status).toBe('published');
  });

  it('allows published → archived', async () => {
    const row = makeRow({ status: 'published' });
    mockPlatformComponent.findUnique.mockResolvedValue(row);
    mockPlatformComponent.update.mockResolvedValue({ ...row, status: 'archived' });
    const result = await svc.archive('pc_123', 'rev_1');
    expect(result.status).toBe('archived');
  });

  it('archived → draft is a legal transition (isLegalTransition)', async () => {
    const { isLegalTransition } = await import('@sparx/builder-schemas');
    expect(isLegalTransition('archived', 'draft')).toBe(true);
  });

  it('approved can be rejected (approved → rejected)', async () => {
    const row = makeRow({ status: 'approved' });
    mockPlatformComponent.findUnique.mockResolvedValue(row);
    mockPlatformComponent.update.mockResolvedValue({ ...row, status: 'rejected' });
    const result = await svc.reject('pc_123', 'rev_1');
    expect(result.status).toBe('rejected');
  });

  it('rejects illegal transition (draft → published)', async () => {
    const row = makeRow({ status: 'draft' });
    mockPlatformComponent.findUnique.mockResolvedValue(row);
    await expect(svc.publish('pc_123', 'rev_1')).rejects.toThrow(
      /Cannot transition from "draft" to "published"/,
    );
    expect(mockPlatformComponent.update).not.toHaveBeenCalled();
  });

  it('rejects illegal transition (published → submitted)', async () => {
    const row = makeRow({ status: 'published' });
    mockPlatformComponent.findUnique.mockResolvedValue(row);
    await expect(svc.submit('pc_123', 'actor_1')).rejects.toThrow(
      /Cannot transition from "published" to "submitted"/,
    );
  });

  it('throws NOT_FOUND for missing id', async () => {
    mockPlatformComponent.findUnique.mockResolvedValue(null);
    await expect(svc.submit('missing_id', 'actor_1')).rejects.toThrow();
  });
});

describe('platformCatalogService — published-only visibility', () => {
  it('listPublished only queries status=published', async () => {
    mockPlatformComponent.findMany.mockResolvedValue([]);
    await svc.listPublished();
    expect(mockPlatformComponent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'published', visibility: 'public' }),
      }),
    );
  });

  it('getPublishedByKey rejects a non-published row', async () => {
    mockPlatformComponent.findUnique.mockResolvedValue(makeRow({ status: 'draft' }));
    await expect(svc.getPublishedByKey('hero_split')).rejects.toThrow(
      /platform_component.*hero_split.*not found/i,
    );
  });

  it('getPublishedByKey returns a published row', async () => {
    const row = makeRow({ status: 'published' });
    mockPlatformComponent.findUnique.mockResolvedValue(row);
    const result = await svc.getPublishedByKey('hero_split');
    expect(result.status).toBe('published');
  });
});

describe('platformCatalogService — CRUD', () => {
  it('create rejects duplicate key', async () => {
    mockPlatformComponent.findUnique.mockResolvedValue(makeRow());
    const input = {
      key: 'hero_split',
      name: 'Split Hero',
      kind: 'comprehensive' as const,
      tree: { id: 'root', type: 'Section', class: '', props: {}, children: [] },
    };
    await expect(svc.create('user_abc', input)).rejects.toThrow(/key.*already/i);
    expect(mockPlatformComponent.create).not.toHaveBeenCalled();
  });

  it('create sets status=draft and version=1', async () => {
    mockPlatformComponent.findUnique.mockResolvedValue(null);
    const row = makeRow({ status: 'draft', version: 1 });
    mockPlatformComponent.create.mockResolvedValue(row);
    const input = {
      key: 'hero_split',
      name: 'Split Hero',
      kind: 'comprehensive' as const,
      tree: { id: 'root', type: 'Section', class: '', props: {}, children: [] },
    };
    const result = await svc.create('user_abc', input);
    expect(result.status).toBe('draft');
    expect(result.version).toBe(1);
  });
});
