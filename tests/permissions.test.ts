import { describe, expect, it } from 'vitest';
import { sameDocument, websiteOrigin } from '../src/shared/permissions';
describe('pending website decisions', () => {
  const request = { contentsId: 1, url: 'https://example.org/work', revision: 1 };
  it('applies a decision only to the exact requesting document', () => {
    expect(sameDocument(request, { ...request })).toBe(true);
    expect(sameDocument(request, { ...request, contentsId: 2 })).toBe(false);
    expect(sameDocument(request, { ...request, url: 'https://example.org/other' })).toBe(false);
    expect(sameDocument(request, { ...request, revision: 2 })).toBe(false);
    expect(sameDocument(request, undefined)).toBe(false);
  });
  it('accepts only ordinary web origins without embedded credentials', () => {
    expect(websiteOrigin('https://example.org/work')).toBe('https://example.org');
    expect(websiteOrigin('file:///private')).toBeUndefined();
    expect(websiteOrigin('https://user:password@example.org')).toBeUndefined();
  });
});
