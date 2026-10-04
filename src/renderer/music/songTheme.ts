export function songColor(identity: string) {
  let hash = 0;
  for (const letter of identity) hash = (hash * 31 + letter.charCodeAt(0)) | 0;
  return ['#b8a2e3', '#91c8c1', '#e4a185', '#93b5dc', '#d7a0be', '#d1ba88'][Math.abs(hash) % 6];
}
