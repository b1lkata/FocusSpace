import { expect, it } from 'vitest';
import { findSongs, youtubeId, youtubeSearch } from '../src/renderer/music/youtube';
it('recognizes only supported YouTube hosts and safe video IDs', () => {
  for (const url of ['https://youtu.be/4NRXx6U8ABQ?t=10', 'https://www.youtube.com/watch?v=4NRXx6U8ABQ', 'https://m.youtube.com/shorts/4NRXx6U8ABQ']) expect(youtubeId(url)).toBe('4NRXx6U8ABQ');
  for (const url of ['https://youtube.com.evil.test/watch?v=4NRXx6U8ABQ', 'javascript:alert(1)', 'https://user:password@youtube.com/watch?v=4NRXx6U8ABQ', 'https://youtube.com/watch?v=bad', 'https://example.org/4NRXx6U8ABQ']) expect(youtubeId(url)).toBeUndefined();
});
it('matches song and artist words without claiming a live search', () => {
  expect(findSongs('weeknd lights')).toHaveLength(1); expect(findSongs('get lucky', 'daft')).toHaveLength(1); expect(findSongs('anything unavailable')).toEqual([]);
  expect(youtubeSearch('a & b')).toBe('https://www.youtube.com/results?search_query=a%20%26%20b');
});
