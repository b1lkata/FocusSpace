import albums from './featuredAlbums.json';
export const normalizeSearch = (value: string) => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
// Restricted Damerau-Levenshtein: includes one adjacent-letter swap.
export function spellingDistance(left: string, right: string) {
  const a = [...left], b = [...right];
  const rows = Array.from({ length: a.length + 1 }, (_, i) => Array.from({ length: b.length + 1 }, (_, j) => i ? j ? 0 : i : j));
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + Number(a[i - 1] !== b[j - 1]));
    if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) rows[i][j] = Math.min(rows[i][j], rows[i - 2][j - 2] + 1);
  }
  return rows[a.length][b.length];
}
export function closeSearchWord(word: string, token: string) {
  if (token.startsWith(word)) return true;
  return word.length >= 4 && Math.abs(word.length - token.length) <= 1 && spellingDistance(word, token) <= 1;
}
const phrases = [...new Set(albums.flatMap(album => [album.artist, album.title, ...album.tracks.map(track => track.title)]))];
const words = [...new Set(phrases.flatMap(phrase => normalizeSearch(phrase).split(' ')))];
export function correctedSearch(value: string) {
  const normalized = normalizeSearch(value.slice(0, 200));
  if (!normalized || phrases.some(phrase => normalizeSearch(phrase) === normalized)) return value.trim().slice(0, 200);
  const matches = phrases.map(phrase => ({ phrase, normalized: normalizeSearch(phrase) })).filter(candidate => Math.abs(candidate.normalized.length - normalized.length) <= 2 && normalized.length >= 5 && candidate.normalized.split(' ').length === normalized.split(' ').length).map(candidate => ({ ...candidate, distance: spellingDistance(normalized, candidate.normalized) })).filter(candidate => candidate.distance <= (normalized.length >= 10 ? 2 : 1)).sort((a, b) => a.distance - b.distance);
  if (matches.length && (matches.length === 1 || matches[0].distance < matches[1].distance)) return matches[0].phrase;
  const corrected = normalized.split(' ').map(word => {
    if (word.length < 4 || words.includes(word) || words.some(known => known.startsWith(word))) return word;
    const candidates = words.filter(known => Math.abs(known.length - word.length) <= 1 && spellingDistance(word, known) === 1);
    return candidates.length === 1 ? candidates[0] : word;
  }).join(' ');
  return corrected === normalized ? value.trim().slice(0, 200) : corrected;
}
