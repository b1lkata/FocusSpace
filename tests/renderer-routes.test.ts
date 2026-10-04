import { expect, it } from 'vitest';
import { authorizedSender, rendererDocumentUrl } from '../src/shared/security';
it('permits only music/legacy presentations and anchors of the same trusted main document', () => {
  const trusted = 'file:///app/index.html';
  for (const frame of [trusted, `${trusted}#discover`, `${trusted}?legacy=1#your-spaces`]) expect(authorizedSender(1, 1, rendererDocumentUrl(frame), trusted, true)).toBe(true);
  for (const frame of ['https://example.org/?legacy=1', 'file:///app/other.html', `${trusted}?legacy=2`, `${trusted}?legacy=1&url=https://example.org`]) expect(authorizedSender(1, 1, rendererDocumentUrl(frame), trusted, true)).toBe(false);
  expect(authorizedSender(2, 1, rendererDocumentUrl(`${trusted}?legacy=1`), trusted, true)).toBe(false);
  expect(authorizedSender(1, 1, rendererDocumentUrl(`${trusted}?legacy=1`), trusted, false)).toBe(false);
});
